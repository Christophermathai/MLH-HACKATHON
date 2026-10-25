"use client";

import React, { useEffect, useRef, useState } from "react";
import type { MediatorResult, SafetyResult, AudioManifest, Outcome } from "@zoomout/contracts";

export interface AudioChunk {
  seq: number;
  mime: string;
  data: string; // base64
}

export interface VerdictScreenProps {
  roomCode: string;
  side: "A" | "B";
  mediatorResult: MediatorResult | null;
  verdictText: string;
  safetyResult: SafetyResult | null;
  outcome: Outcome | null;
  audioChunks: Map<number, AudioChunk>;
  audioManifest: AudioManifest | null;
  onReplay?: () => void;
  onStartNewRoom?: () => void;
}

export function VerdictScreen({
  roomCode,
  side,
  mediatorResult,
  verdictText,
  safetyResult,
  outcome,
  audioChunks,
  audioManifest,
  onReplay,
  onStartNewRoom,
}: VerdictScreenProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSeq, setCurrentSeq] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playQueueRef = useRef<number[]>([]);
  const isPlayingRef = useRef(false);

  // Helper to play a specific chunk
  const playChunk = (seq: number) => {
    const chunk = audioChunks.get(seq);
    if (!chunk || !chunk.data) {
      advanceQueue();
      return;
    }

    try {
      const audioSrc = `data:${chunk.mime || "audio/mpeg"};base64,${chunk.data}`;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      audio.src = audioSrc;
      setCurrentSeq(seq);
      setIsPlaying(true);
      isPlayingRef.current = true;

      audio.onended = () => {
        advanceQueue();
      };
      audio.onerror = () => {
        setAudioError(`Audio sentence ${seq + 1} could not be decoded locally.`);
        advanceQueue();
      };

      audio.play().catch(() => {
        // Autoplay policy blocked; user must click play
        setIsPlaying(false);
        isPlayingRef.current = false;
      });
    } catch (err: any) {
      setAudioError(err?.message || "Playback error");
      advanceQueue();
    }
  };

  const advanceQueue = () => {
    if (playQueueRef.current.length > 0) {
      const nextSeq = playQueueRef.current.shift()!;
      playChunk(nextSeq);
    } else {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentSeq(null);
    }
  };

  // Enqueue new chunks in order as they arrive
  useEffect(() => {
    const sortedSeqs = Array.from(audioChunks.keys()).sort((a, b) => a - b);
    for (const seq of sortedSeqs) {
      if (!playQueueRef.current.includes(seq) && currentSeq !== seq && (currentSeq === null || seq > currentSeq)) {
        if (!isPlayingRef.current) {
          playChunk(seq);
        } else {
          playQueueRef.current.push(seq);
        }
      }
    }
  }, [audioChunks.size]);

  const togglePlayPause = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else if (audioRef.current && currentSeq !== null) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      });
    } else {
      // Start from beginning
      handleFullReplay();
    }
  };

  const handleFullReplay = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const sortedSeqs = Array.from(audioChunks.keys()).sort((a, b) => a - b);
    if (sortedSeqs.length > 0) {
      playQueueRef.current = sortedSeqs.slice(1);
      playChunk(sortedSeqs[0]);
    }
    onReplay?.();
  };

  // If this is a safety outcome
  if (safetyResult || outcome === "safety") {
    return (
      <div className="verdict-screen max-w-2xl mx-auto p-6 space-y-6">
        <div className="border-b pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Room: {roomCode} · Session Halted
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 mt-1">
            Care & Safety Recommendation
          </h2>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-6 space-y-4 text-amber-950 dark:text-amber-100">
          <p className="leading-relaxed font-sans text-base">
            {safetyResult?.message ||
              "This conversation may involve serious issues or safety concerns beyond the scope of a playful petty court. You are not required to apologize or reconcile. We recommend speaking with someone you trust or a qualified professional."}
          </p>

          <p className="text-xs text-muted-foreground pt-2">
            ZoomOut does not adjudicate serious allegations, assess fault, or pressure reconciliation.
          </p>
        </div>

        {onStartNewRoom && (
          <div className="pt-4 text-center">
            <button
              onClick={onStartNewRoom}
              type="button"
              className="py-2.5 px-5 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition"
            >
              Start a New Room
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="verdict-screen max-w-3xl mx-auto p-6 space-y-8">
      {/* Masthead */}
      <div className="border-b pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Room: {roomCode} · Side {side}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">The Court&apos;s Verdict</h1>
        </div>
        {mediatorResult && (
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
              Petty Score
            </span>
            <span className="text-3xl font-black text-primary">
              {mediatorResult.petty_score}
              <span className="text-sm font-normal text-muted-foreground">/10</span>
            </span>
          </div>
        )}
      </div>

      {/* Spoken Audio Player Bar */}
      <div className="p-4 bg-muted/30 border rounded-xl flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow hover:opacity-95 transition"
            aria-label={isPlaying ? "Pause audio verdict" : "Play audio verdict"}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zm10.5 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <div>
            <p className="text-sm font-semibold">Spoken Verdict</p>
            <p className="text-xs text-muted-foreground">
              {isPlaying
                ? `Playing sentence ${(currentSeq ?? 0) + 1} of ${audioManifest?.totalSentences || audioChunks.size}...`
                : audioChunks.size > 0
                ? "Audio ready to play"
                : "Awaiting audio generation..."}
            </p>
          </div>
        </div>

        {audioChunks.size > 0 && (
          <button
            type="button"
            onClick={handleFullReplay}
            className="text-xs px-3 py-1.5 border rounded-lg bg-background hover:bg-muted font-medium transition"
          >
            Replay Full Verdict
          </button>
        )}
      </div>

      {audioError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
          {audioError} (The verdict text remains fully readable below.)
        </div>
      )}

      {/* Spoken Judge Text Stream */}
      {verdictText && (
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-3">
          <span className="text-xs uppercase tracking-wider font-semibold text-primary block">
            Judge Ruling (മലയാളം)
          </span>
          <p className="font-sans text-lg leading-relaxed text-card-foreground whitespace-pre-wrap" lang="ml">
            {verdictText}
          </p>
        </div>
      )}

      {/* Mediator Analysis Cards */}
      {mediatorResult && (
        <div className="space-y-6">
          {/* Perspectives Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 border rounded-xl bg-muted/20 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Side A&apos;s Perspective
              </span>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {mediatorResult.what_each_is_upset_about.A.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="p-5 border rounded-xl bg-muted/20 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Side B&apos;s Perspective
              </span>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {mediatorResult.what_each_is_upset_about.B.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Differing Interpretations */}
          {mediatorResult.where_interpretations_differ.length > 0 && (
            <div className="p-5 border rounded-xl bg-muted/10 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Where Interpretations Differ
              </span>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {mediatorResult.where_interpretations_differ.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Zoom-Out Bigger Picture */}
          <div className="p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-primary block">
              Zoom-Out Perspective
            </span>
            <p className="text-sm font-medium">
              <strong className="text-foreground">Immediate Issue:</strong> {mediatorResult.zoom_out.immediate_issue}
            </p>
            <p className="text-sm font-medium">
              <strong className="text-foreground">Underlying Feelings:</strong>{" "}
              {mediatorResult.zoom_out.possible_underlying_feelings.join(", ")}
            </p>
            <p className="text-sm font-medium text-foreground pt-1 border-t border-primary/10">
              <strong>The Bigger Picture:</strong> {mediatorResult.zoom_out.bigger_picture}
            </p>
          </div>

          {/* Truce Card */}
          <div className="p-6 border border-emerald-500/30 bg-emerald-500/5 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-widest">Practical Truce</span>
            </div>
            <p className="text-base font-semibold text-foreground">
              {mediatorResult.truce.next_step}
            </p>
            <p className="text-xs text-muted-foreground italic">
              No formal apology required. Just a lighthearted reset.
            </p>
          </div>
        </div>
      )}

      {/* Footer / New Room Action */}
      {onStartNewRoom && (
        <div className="pt-6 border-t text-center">
          <button
            type="button"
            onClick={onStartNewRoom}
            className="py-2.5 px-6 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:opacity-90 transition text-sm shadow-sm"
          >
            Start a New Room
          </button>
        </div>
      )}
    </div>
  );
}
