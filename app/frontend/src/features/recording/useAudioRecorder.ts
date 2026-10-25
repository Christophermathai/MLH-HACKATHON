"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LIMITS } from "@zoomout/contracts";

export type RecorderStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopping"
  | "denied"
  | "error";

export interface UseAudioRecorderOptions {
  onChunk: (chunk: ArrayBuffer) => void;
  onAutoStop?: () => void;
  onError?: (err: string) => void;
}

export function useAudioRecorder({
  onChunk,
  onAutoStop,
  onError,
}: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalBytesRef = useRef<number>(0);

  const stopAllTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const detectSupportedMime = useCallback((): string => {
    if (typeof MediaRecorder === "undefined") {
      return "audio/webm;codecs=opus";
    }
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
    ];
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return "audio/webm";
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      setStatus("stopping");
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopAllTracks();
  }, [clearTimer, stopAllTracks]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopAllTracks();
    totalBytesRef.current = 0;
    setElapsedSeconds(0);
    setStatus("idle");
  }, [clearTimer, stopAllTracks]);

  const startRecording = useCallback(
    async (): Promise<{ mode: "batch"; mime: string } | null> => {
      setErrorMessage(null);
      setStatus("requesting_permission");
      totalBytesRef.current = 0;
      setElapsedSeconds(0);

      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Audio recording is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        const mime = detectSupportedMime();
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = async (e: BlobEvent) => {
          if (!e.data || e.data.size === 0) return;

          // Check if accumulating exceeds 5 MiB ceiling
          if (
            totalBytesRef.current + e.data.size >
            LIMITS.MAX_AUDIO_TOTAL_BYTES
          ) {
            stopRecording();
            onAutoStop?.();
            return;
          }

          totalBytesRef.current += e.data.size;
          const arrayBuffer = await e.data.arrayBuffer();

          // Slice chunk if larger than 32 KiB
          const maxChunk = LIMITS.MAX_AUDIO_FRAME_BYTES;
          if (arrayBuffer.byteLength > maxChunk) {
            for (let offset = 0; offset < arrayBuffer.byteLength; offset += maxChunk) {
              const slice = arrayBuffer.slice(
                offset,
                Math.min(offset + maxChunk, arrayBuffer.byteLength)
              );
              onChunk(slice);
            }
          } else {
            onChunk(arrayBuffer);
          }
        };

        recorder.onerror = (e) => {
          const msg = (e as any).error?.message || "Recorder encountered an error";
          setErrorMessage(msg);
          setStatus("error");
          onError?.(msg);
          stopAllTracks();
        };

        // Capture in slices of 250ms
        recorder.start(250);
        setStatus("recording");

        // Start elapsed timer
        const startTime = Date.now();
        timerIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setElapsedSeconds(elapsed);

          // Enforce 60-second limit
          if (elapsed >= LIMITS.MAX_AUDIO_RECORDING_SECONDS) {
            stopRecording();
            onAutoStop?.();
          }
        }, 200);

        return { mode: "batch", mime };
      } catch (err: any) {
        stopAllTracks();
        clearTimer();
        const isPermissionDenied =
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.message?.includes("Permission denied");

        if (isPermissionDenied) {
          setStatus("denied");
          setErrorMessage(
            "Microphone access was denied. You can proceed directly using typed input."
          );
        } else {
          setStatus("error");
          setErrorMessage(err.message || "Failed to start microphone.");
        }
        onError?.(err.message || "Microphone error");
        return null;
      }
    },
    [
      detectSupportedMime,
      onChunk,
      onAutoStop,
      onError,
      stopRecording,
      stopAllTracks,
      clearTimer,
    ]
  );

  // Cleanup on unmount: ensure all microphone tracks are released immediately
  useEffect(() => {
    return () => {
      clearTimer();
      stopAllTracks();
    };
  }, [clearTimer, stopAllTracks]);

  return {
    status,
    elapsedSeconds,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
    releaseMediaTracks: stopAllTracks,
  };
}
