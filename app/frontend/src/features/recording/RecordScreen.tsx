"use client";

import React from "react";
import { Side, LIMITS } from "@zoomout/contracts";
import { useAudioRecorder, RecorderStatus } from "./useAudioRecorder";

export interface RecordScreenProps {
  room: string;
  side: Side;
  isTranscribing: boolean;
  onStartRecordingSession: (mode: "batch", mime: string) => void;
  onSendAudioChunk: (chunk: ArrayBuffer) => void;
  onStopRecordingSession: () => void;
  onCancelRecordingSession: () => void;
  onStartTypedInput: () => void;
}

export function RecordScreen({
  room,
  side,
  isTranscribing,
  onStartRecordingSession,
  onSendAudioChunk,
  onStopRecordingSession,
  onCancelRecordingSession,
  onStartTypedInput,
}: RecordScreenProps) {
  const {
    status,
    elapsedSeconds,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onChunk: onSendAudioChunk,
    onAutoStop: () => {
      onStopRecordingSession();
    },
  });

  const handleStart = async () => {
    const res = await startRecording();
    if (res) {
      onStartRecordingSession(res.mode, res.mime);
    }
  };

  const handleStop = () => {
    stopRecording();
    onStopRecordingSession();
  };

  const handleCancel = () => {
    cancelRecording();
    onCancelRecordingSession();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isRecording = status === "recording";
  const isDenied = status === "denied";

  return (
    <div className="record-container" style={{ maxWidth: "680px", margin: "40px auto", padding: "32px", background: "var(--cream)", border: "2px solid var(--ink)", borderRadius: "4px", boxShadow: "var(--shadow)" }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "24px" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--red)" }}>
            ZOOMOUT PETTY COURT
          </span>
          <h2 style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 700 }}>
            Participant {side} Testimony
          </h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>Room Code</div>
          <div style={{ fontSize: "16px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "2px" }}>
            {room}
          </div>
        </div>
      </div>

      {/* Main recording body */}
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <p style={{ fontSize: "22px", margin: "0 0 8px", fontFamily: "'Noto Sans Malayalam', sans-serif", fontWeight: 600 }}>
          നിങ്ങളുടെ ഭാഗം പറയൂ
        </p>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 28px" }}>
          State your side of the dispute in Malayalam or Malayalam-English. Maximum 60 seconds.
        </p>

        {/* State displays */}
        {isDenied && (
          <div style={{ background: "#fee2e2", border: "1px solid #ef4444", padding: "16px", borderRadius: "4px", marginBottom: "24px", textAlign: "left" }}>
            <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#991b1b" }}>
              Microphone Permission Denied
            </p>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#7f1d1d" }}>
              Microphone access is unavailable or was denied by your browser. You can proceed directly using typed input without re-prompting.
            </p>
            <button
              onClick={onStartTypedInput}
              style={{ background: "var(--red)", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "3px", fontWeight: "bold", cursor: "pointer" }}
            >
              Continue with Typed Input →
            </button>
          </div>
        )}

        {isTranscribing ? (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ display: "inline-block", width: "40px", height: "40px", border: "4px solid var(--line)", borderTopColor: "var(--red)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: 600 }}>
              Transcribing audio with Whisper Large v3...
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>
              Processing Malayalam speech and code-switching...
            </p>
          </div>
        ) : isRecording ? (
          <div style={{ padding: "20px 0" }}>
            {/* Timer and Wave indicator */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--red)", animation: "pulse 1.2s infinite" }} />
              <span style={{ fontSize: "28px", fontWeight: "bold", fontFamily: "monospace" }}>
                {formatTimer(elapsedSeconds)} / {formatTimer(LIMITS.MAX_AUDIO_RECORDING_SECONDS)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <button
                onClick={handleStop}
                style={{
                  background: "var(--red)",
                  color: "#fff",
                  border: "none",
                  padding: "14px 28px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(185, 56, 34, 0.3)",
                }}
              >
                ■ Stop &amp; Transcribe
              </button>
              <button
                onClick={handleCancel}
                style={{
                  background: "transparent",
                  color: "var(--muted)",
                  border: "1px solid var(--line)",
                  padding: "14px 20px",
                  fontSize: "15px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !isDenied && (
          <div style={{ padding: "20px 0" }}>
            <button
              onClick={handleStart}
              style={{
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                padding: "16px 36px",
                fontSize: "17px",
                fontWeight: "bold",
                borderRadius: "4px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 6px 16px rgba(21, 21, 18, 0.2)",
              }}
            >
              <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--red)" }} />
              Start Recording
            </button>
            {errorMessage && (
              <p style={{ color: "var(--red)", fontSize: "14px", marginTop: "12px" }}>
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {/* Typed Alternative Escape */}
        <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px dashed var(--line)" }}>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 8px" }}>
            Microphone issues or prefer not to speak?
          </p>
          <button
            onClick={onStartTypedInput}
            style={{
              background: "none",
              border: "none",
              color: "var(--teal)",
              textDecoration: "underline",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Write your statement directly instead →
          </button>
        </div>
      </div>
    </div>
  );
}
