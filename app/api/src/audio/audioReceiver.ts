import crypto from "node:crypto";
import {
  Side,
  LIMITS,
  ZoomOutPublicError,
  RecordingMode,
} from "@zoomout/contracts";
import { SessionData } from "../sessions/sessionTypes.js";
import { transitionParticipant } from "../sessions/stateMachine.js";
import { sendToSide } from "../transport/projections.js";
import { SttProvider } from "../providers/types.js";

export const SUPPORTED_AUDIO_MIMES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/l16",
  "audio/raw",
];

export interface ActiveRecording {
  room: string;
  side: Side;
  recordingId: string;
  mode: RecordingMode;
  mime: string;
  chunks: Buffer[];
  totalBytes: number;
  startedAt: number;
  timeoutTimer: NodeJS.Timeout;
  abortController: AbortController;
}

export class AudioReceiver {
  private activeRecordings = new Map<string, ActiveRecording>();

  constructor(private sttProvider: SttProvider) {}

  private key(room: string, side: Side): string {
    return `${room.toUpperCase()}:${side}`;
  }

  public getActiveRecording(room: string, side: Side): ActiveRecording | undefined {
    return this.activeRecordings.get(this.key(room, side));
  }

  public startRecording(
    session: SessionData,
    side: Side,
    payload: {
      mode: RecordingMode;
      mime: string;
      sampleRate?: number;
      channels?: number;
      format?: string;
    },
    requestId?: string
  ): void {
    // Check supported MIME
    const isMimeSupported = SUPPORTED_AUDIO_MIMES.some((m) =>
      payload.mime.toLowerCase().startsWith(m.toLowerCase())
    );
    if (!isMimeSupported) {
      throw new ZoomOutPublicError(
        "BAD_AUDIO",
        `Unsupported audio MIME type: ${payload.mime}`
      );
    }

    // Check if declaring encoded MediaRecorder bytes as PCM
    if (payload.mode === "batch" && payload.mime.includes("pcm")) {
      throw new ZoomOutPublicError(
        "BAD_AUDIO",
        "Encoded batch audio must not be labeled as PCM."
      );
    }

    // Transition side to RECORDING
    transitionParticipant(session, side, "RECORDING");

    // Clean up any stale recording for this side
    this.cleanupRecording(session.room, side);

    const recordingId = crypto.randomUUID();
    const abortController = new AbortController();
    session.activeControllers.add(abortController);

    // Enforce 60-second duration limit
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(session, side, recordingId);
    }, LIMITS.MAX_AUDIO_RECORDING_SECONDS * 1000);

    if (typeof timeoutTimer.unref === "function") {
      timeoutTimer.unref();
    }

    const recording: ActiveRecording = {
      room: session.room,
      side,
      recordingId,
      mode: payload.mode,
      mime: payload.mime,
      chunks: [],
      totalBytes: 0,
      startedAt: Date.now(),
      timeoutTimer,
      abortController,
    };

    this.activeRecordings.set(this.key(session.room, side), recording);

    // Notify client that recording has started
    sendToSide(
      session,
      side,
      "recording_started",
      { mode: payload.mode, mime: payload.mime },
      requestId
    );
  }

  public async handleAudioChunk(
    session: SessionData,
    side: Side,
    chunk: Buffer
  ): Promise<void> {
    const recording = this.getActiveRecording(session.room, side);
    if (!recording || session.states[side] !== "RECORDING") {
      // Ignore frames outside RECORDING state
      return;
    }

    // Check per-frame limit (32 KiB)
    if (chunk.length > LIMITS.MAX_AUDIO_FRAME_BYTES) {
      this.abortWithError(
        session,
        side,
        new ZoomOutPublicError(
          "LIMIT_EXCEEDED",
          `Audio frame of ${chunk.length} bytes exceeds maximum allowed frame size of ${LIMITS.MAX_AUDIO_FRAME_BYTES} bytes`
        )
      );
      return;
    }

    // Check total audio limit (5 MiB)
    if (recording.totalBytes + chunk.length > LIMITS.MAX_AUDIO_TOTAL_BYTES) {
      this.abortWithError(
        session,
        side,
        new ZoomOutPublicError(
          "LIMIT_EXCEEDED",
          `Total audio size exceeds maximum allowed of ${LIMITS.MAX_AUDIO_TOTAL_BYTES} bytes`
        )
      );
      return;
    }

    recording.chunks.push(chunk);
    recording.totalBytes += chunk.length;
  }

  public async stopRecording(
    session: SessionData,
    side: Side,
    requestId?: string
  ): Promise<void> {
    const recording = this.getActiveRecording(session.room, side);
    if (!recording || session.states[side] !== "RECORDING") {
      throw new ZoomOutPublicError(
        "INVALID_STATE",
        `Participant ${side} is not currently recording`
      );
    }

    // Transition to TRANSCRIBING
    transitionParticipant(session, side, "TRANSCRIBING");

    // Clear timeout timer
    clearTimeout(recording.timeoutTimer);

    // Assemble audio buffer and immediately free chunk references
    let audioBuffer = Buffer.concat(recording.chunks);
    recording.chunks = []; // Immediate release of chunk references

    const currentRecId = recording.recordingId;
    const signal = recording.abortController.signal;

    // Check for empty/zero-byte audio
    if (audioBuffer.length === 0) {
      this.cleanupRecording(session.room, side);
      transitionParticipant(session, side, "IDLE");
      sendToSide(session, side, "error", {
        code: "BAD_AUDIO",
        message: "No audio data received. Please record again or use typed input.",
        fallback: "typed_input",
      });
      return;
    }

    try {
      const result = await this.sttProvider.batch(audioBuffer, recording.mime, signal);

      // Verify that this recording is still the active attempt (FR-004-08 late response guard)
      const active = this.getActiveRecording(session.room, side);
      if (!active || active.recordingId !== currentRecId) {
        // Obsolete attempt, discard result
        return;
      }

      // Check for silence / empty output
      let text = (result.text || "").trim();
      if (!text || text === "" || text.includes("ശബ്ദം വ്യക്തമല്ല")) {
        text = text || "[ശബ്ദം വ്യക്തമല്ല / No speech detected]";
      }

      session.transcripts[side] = text;
      transitionParticipant(session, side, "REVIEW");

      // Send final_transcript to the recording side ONLY (AC-004-03)
      sendToSide(
        session,
        side,
        "final_transcript",
        {
          text,
          unclear_lines: result.unclear_lines ?? [],
        },
        requestId
      );
    } catch (err: any) {
      // If aborted, do nothing
      if (signal.aborted) {
        return;
      }

      // If recording is no longer the active one, ignore
      const active = this.getActiveRecording(session.room, side);
      if (!active || active.recordingId !== currentRecId) {
        return;
      }

      // STT failure: transition back to IDLE to allow retry or typed input
      transitionParticipant(session, side, "IDLE");
      sendToSide(session, side, "error", {
        code: "STT_FAILED",
        message: "Speech recognition failed. You can record again or type your statement.",
        fallback: "typed_input",
      });
    } finally {
      // Immediate raw audio deletion (FR-004-06, FR-004-07, AC-004-07)
      audioBuffer = Buffer.alloc(0);
      this.cleanupRecording(session.room, side);
    }
  }

  public cancelRecording(session: SessionData, side: Side, requestId?: string): void {
    this.cleanupRecording(session.room, side);
    if (session.states[side] === "RECORDING" || session.states[side] === "TRANSCRIBING") {
      transitionParticipant(session, side, "IDLE");
    }
  }

  private handleTimeout(session: SessionData, side: Side, recordingId: string): void {
    const recording = this.getActiveRecording(session.room, side);
    if (!recording || recording.recordingId !== recordingId) {
      return;
    }

    // Stop recording automatically on 60s timeout
    this.stopRecording(session, side).catch((err) => {
      this.abortWithError(session, side, err);
    });
  }

  private abortWithError(session: SessionData, side: Side, error: any): void {
    this.cleanupRecording(session.room, side);
    if (session.states[side] === "RECORDING" || session.states[side] === "TRANSCRIBING") {
      try {
        transitionParticipant(session, side, "IDLE");
      } catch {}
    }
    const publicError =
      error instanceof ZoomOutPublicError
        ? error
        : new ZoomOutPublicError("BAD_AUDIO", error.message || "Recording error");

    sendToSide(session, side, "error", {
      code: publicError.code,
      message: publicError.message,
      fallback: "typed_input",
    });
  }

  public cleanupRecording(room: string, side: Side): void {
    const key = this.key(room, side);
    const rec = this.activeRecordings.get(key);
    if (rec) {
      clearTimeout(rec.timeoutTimer);
      rec.abortController.abort();
      // Ensure all chunk references are released immediately
      rec.chunks = [];
      this.activeRecordings.delete(key);
    }
  }

  public cleanupRoom(room: string): void {
    this.cleanupRecording(room, "A");
    this.cleanupRecording(room, "B");
  }
}
