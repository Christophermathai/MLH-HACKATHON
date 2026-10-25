"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Side } from "@zoomout/contracts";

export interface RecordScreenProps {
  roomCode: string;
  side: Side;
  onSendChunk?: (chunk: Uint8Array) => Promise<void> | void;
  onStart?: () => void;
  onStop?: () => void;
  onSwitchToTyped?: () => void;
}

export function RecordScreen({
  roomCode,
  side,
  onSendChunk,
  onStart,
  onStop,
  onSwitchToTyped,
}: RecordScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Microphone access is not supported in this browser. Please switch to typed input.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && onSendChunk) {
          const buffer = await e.data.arrayBuffer();
          onSendChunk(new Uint8Array(buffer));
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsRecording(false);
        onStop?.();
      };

      recorder.start(500); // 500ms chunks
      setIsRecording(true);
      setSeconds(0);
      onStart?.();

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            recorder.stop();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setErrorMessage("Microphone permission was denied. You can type your side instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="record-screen max-w-xl mx-auto p-6 space-y-6">
      {/* Masthead */}
      <div className="border-b pb-4 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Room: {roomCode} · Participant {side}
        </span>
        <h2 className="text-2xl font-bold tracking-tight mt-1">Speak Your Side</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell what happened in your own words. Malayalam or English are both welcome.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-muted/40 border rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">Privacy & Audio Deletion Guarantee</p>
        <p>
          Your recording is sent to a speech provider to generate your transcript. ZoomOut removes its
          copy of the audio immediately after transcription. You will review and edit your text before
          sharing.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Main Recording Surface */}
      <div className="border rounded-2xl p-8 bg-card shadow-sm text-center space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-lg shadow-lg transition-all ${
              isRecording
                ? "bg-red-600 text-white animate-pulse"
                : "bg-primary text-primary-foreground hover:scale-105"
            }`}
          >
            {isRecording ? "Stop" : "Record"}
          </button>

          <div className="text-sm font-semibold">
            {isRecording ? (
              <span className="text-red-600 dark:text-red-400">
                Recording · {seconds}s / 60s
              </span>
            ) : (
              <span className="text-muted-foreground">Tap to begin speaking</span>
            )}
          </div>
        </div>

        {/* Fallback Action */}
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={onSwitchToTyped}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Don&apos;t want to record? Type your side instead →
          </button>
        </div>
      </div>
    </div>
  );
}

