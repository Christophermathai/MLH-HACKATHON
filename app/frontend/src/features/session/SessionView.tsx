"use client";

import React, { useEffect, useRef, useState } from "react";
import type {
  Side,
  SessionSnapshot,
  MediatorResult,
  SafetyResult,
  AudioManifest,
  Outcome,
  SessionState,
} from "@zoomout/contracts";
import { RecordScreen } from "../recording/RecordScreen";
import { ReviewScreen } from "../review/ReviewScreen";
import { VerdictScreen, AudioChunk } from "../verdict/VerdictScreen";

interface SessionViewProps {
  gatewayHttpUrl?: string;
  gatewayWsUrl?: string;
}

export function SessionView({
  gatewayHttpUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || "http://127.0.0.1:8787",
  gatewayWsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "ws://127.0.0.1:8787/ws",
}: SessionViewProps) {
  // Session Identity
  const [room, setRoom] = useState<string | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [resumeToken, setResumeToken] = useState<string | null>(null);

  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // App State
  const [sessionState, setSessionState] = useState<SessionState>("CREATED");
  const [ownState, setOwnState] = useState<string>("IDLE");
  const [transcript, setTranscript] = useState<string>("");
  const [unclearLines, setUnclearLines] = useState<string[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isOtherSideReady, setIsOtherSideReady] = useState(false);

  // Results State
  const [mediatorResult, setMediatorResult] = useState<MediatorResult | null>(null);
  const [verdictText, setVerdictText] = useState<string>("");
  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [audioChunks, setAudioChunks] = useState<Map<number, AudioChunk>>(new Map());
  const [audioManifest, setAudioManifest] = useState<AudioManifest | null>(null);

  // Lobby Inputs
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  // Auto-fill room code from URL query parameter ?room=CODE
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("room");
      if (r && r.length === 8) {
        setJoinCodeInput(r.toUpperCase());
      }
    }
  }, []);

  // Create room as Side A
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    setConnectionError(null);
    try {
      const res = await fetch(`${gatewayHttpUrl}/api/rooms`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
      const data = await res.json();
      setRoom(data.room);
      setSide(data.side);
      setResumeToken(data.resumeToken);
    } catch (err: any) {
      setConnectionError(err?.message || "Failed to create room");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join room as Side B
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;

    setIsCreatingRoom(true);
    setConnectionError(null);
    try {
      const res = await fetch(`${gatewayHttpUrl}/api/rooms/${code}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `Failed to claim Side B (${res.status})`);
      }
      const data = await res.json();
      setRoom(data.room);
      setSide(data.side);
      setResumeToken(data.resumeToken);
    } catch (err: any) {
      setConnectionError(err?.message || "Failed to join room");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Connect WebSocket when room + side + resumeToken are ready
  useEffect(() => {
    if (!room || !side || !resumeToken) return;

    const ws = new WebSocket(gatewayWsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
      // Send join
      ws.send(
        JSON.stringify({
          v: 1,
          type: "join",
          payload: { room, side, resumeToken },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "session_snapshot": {
            const snap = msg.payload as SessionSnapshot;
            setSessionState(snap.sessionState);
            setOwnState(snap.ownState);
            setIsConfirmed(snap.ownConfirmed);
            if (snap.ownText) setTranscript(snap.ownText);
            const otherSide = side === "A" ? "B" : "A";
            setIsOtherSideReady(snap.readiness[otherSide]);
            if (snap.sharedResult) setMediatorResult(snap.sharedResult);
            if (snap.verdictText) setVerdictText(snap.verdictText);
            if (snap.outcome) setOutcome(snap.outcome);
            if (snap.audioManifest) setAudioManifest(snap.audioManifest);
            break;
          }

          case "final_transcript": {
            setTranscript(msg.payload.text || "");
            if (msg.payload.unclear_lines) setUnclearLines(msg.payload.unclear_lines);
            setOwnState("REVIEW");
            break;
          }

          case "side_ready": {
            if (msg.payload.side === side) {
              setIsConfirmed(true);
              setOwnState("READY");
            } else {
              setIsOtherSideReady(true);
            }
            break;
          }

          case "both_ready": {
            setIsOtherSideReady(true);
            setSessionState("BOTH_READY");
            break;
          }

          case "analysis_json": {
            setMediatorResult(msg.payload);
            setSessionState("MEDIATING");
            break;
          }

          case "verdict_text_delta": {
            setVerdictText((prev) => prev + msg.payload.text);
            setSessionState("JUDGING");
            break;
          }

          case "safety_result": {
            setSafetyResult(msg.payload);
            setSessionState("DONE");
            setOutcome("safety");
            break;
          }

          case "audio_chunk": {
            const chunk: AudioChunk = {
              seq: msg.payload.seq,
              mime: msg.payload.mime,
              data: msg.payload.data,
            };
            setAudioChunks((prev) => {
              const next = new Map(prev);
              next.set(chunk.seq, chunk);
              return next;
            });
            break;
          }

          case "audio_manifest": {
            setAudioManifest(msg.payload);
            break;
          }

          case "done": {
            setOutcome(msg.payload.outcome);
            setSessionState("DONE");
            break;
          }

          case "error": {
            setConnectionError(msg.payload.message || msg.payload.code || "Server error");
            break;
          }
        }
      } catch (err: any) {
        console.error("Failed to parse server message:", err);
      }
    };

    ws.onerror = () => {
      setConnectionError("WebSocket connection error");
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [room, side, resumeToken, gatewayWsUrl]);

  // Audio Chunk Sender for Recording Screen
  const handleSendAudioChunk = async (chunk: Uint8Array) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(new Blob([chunk.buffer as ArrayBuffer]));
    }
  };

  const handleStartRecording = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          v: 1,
          type: "start_recording",
          payload: { mode: "pcm", mime: "audio/wav" },
        })
      );
    }
  };

  const handleStopRecording = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          v: 1,
          type: "stop_recording",
          payload: {},
        })
      );
    }
  };

  const handleStartTypedInput = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          v: 1,
          type: "start_typed_input",
          payload: {},
        })
      );
    }
  };

  const handleConfirmTranscript = (text: string, consent: true) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          v: 1,
          type: "confirm_transcript",
          payload: { text, consent },
        })
      );
    }
  };

  const handleReplayAudio = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          v: 1,
          type: "replay_audio",
          payload: {},
        })
      );
    }
  };

  const resetAll = () => {
    if (socketRef.current) socketRef.current.close();
    setRoom(null);
    setSide(null);
    setResumeToken(null);
    setTranscript("");
    setIsConfirmed(false);
    setIsOtherSideReady(false);
    setMediatorResult(null);
    setVerdictText("");
    setSafetyResult(null);
    setOutcome(null);
    setAudioChunks(new Map());
    setAudioManifest(null);
    setSessionState("CREATED");
    setOwnState("IDLE");
  };

  // Lobby Screen (when not yet in a room)
  if (!room || !side) {
    return (
      <div className="lobby-container max-w-md mx-auto p-8 space-y-8 bg-card border rounded-2xl shadow-lg my-12">
        <div className="text-center space-y-2">
          <span className="text-3xl font-black tracking-tight text-primary">ZoomOut</span>
          <p className="text-sm font-medium text-muted-foreground">
            Big feelings. Small problems. Calm perspectives.
          </p>
        </div>

        {connectionError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-300">
            {connectionError}
          </div>
        )}

        {/* Action A: Create Room */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreatingRoom}
            className="w-full py-3.5 px-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:opacity-95 transition disabled:opacity-50"
          >
            {isCreatingRoom ? "Creating Room..." : "Create New Dispute Room (Side A)"}
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            Creates a private 30-minute session and generates a shareable room code.
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t w-full border-muted" />
          <span className="bg-card px-3 text-xs text-muted-foreground uppercase font-semibold">
            Or Join Existing
          </span>
        </div>

        {/* Action B: Join Room */}
        <form onSubmit={handleJoinRoom} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
              8-Character Room Code
            </label>
            <input
              type="text"
              maxLength={8}
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="e.g. 3F8A2B9C"
              className="w-full text-center tracking-widest font-mono text-lg py-2.5 px-3 border rounded-xl uppercase focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isCreatingRoom || joinCodeInput.trim().length !== 8}
            className="w-full py-3 px-4 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            Join as Participant B
          </button>
        </form>
      </div>
    );
  }

  // Active Session Navigation
  const isPostConsent =
    sessionState === "MEDIATING" ||
    sessionState === "JUDGING" ||
    sessionState === "DONE" ||
    mediatorResult !== null ||
    verdictText.length > 0 ||
    safetyResult !== null;

  return (
    <div className="session-shell min-h-screen pb-16">
      {/* Top Banner / Room Header */}
      <header className="border-b bg-card py-3 px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-bold tracking-tight">ZoomOut</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">
            Room: {room}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            Side {side}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Connected" : "Reconnecting..."}
          </span>
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Share room code banner for Side A when Side B hasn't joined */}
      {side === "A" && !isOtherSideReady && !isPostConsent && (
        <aside className="bg-primary/5 border-b py-2.5 px-6 flex items-center justify-center gap-3 text-xs text-primary font-medium">
          <span>
            Share this room code with the other person:{" "}
            <strong className="font-mono text-sm underline tracking-wider">{room}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/?room=${room}`;
              navigator.clipboard.writeText(url);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2500);
            }}
            className="py-1 px-2.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
          >
            {copiedLink ? "✓ Copied Invite Link!" : "Copy Invite Link"}
          </button>
        </aside>
      )}

      {/* Screen Routing */}
      <main className="py-6">
        {isPostConsent ? (
          <VerdictScreen
            roomCode={room}
            side={side}
            mediatorResult={mediatorResult}
            verdictText={verdictText}
            safetyResult={safetyResult}
            outcome={outcome}
            audioChunks={audioChunks}
            audioManifest={audioManifest}
            onReplay={handleReplayAudio}
            onStartNewRoom={resetAll}
          />
        ) : ownState === "REVIEW" || ownState === "READY" || isConfirmed ? (
          <ReviewScreen
            roomCode={room}
            initialText={transcript}
            unclearLines={unclearLines}
            isConfirmed={isConfirmed}
            isOtherSideReady={isOtherSideReady}
            onConfirm={handleConfirmTranscript}
            onStartNewRoom={resetAll}
          />
        ) : (
          <RecordScreen
            roomCode={room}
            side={side}
            onSendChunk={handleSendAudioChunk}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onSwitchToTyped={handleStartTypedInput}
          />
        )}
      </main>
    </div>
  );
}

