import crypto from "node:crypto";
import { WebSocket } from "ws";
import {
  Side,
  ParticipantState,
  SessionState,
  Outcome,
  AudioStatus,
  AnalystOutput,
  MediatorResult,
  AudioManifest,
} from "@zoomout/contracts";

export interface CachedAudioClip {
  seq: number;
  mime: string;
  data: string; // base64
  status: AudioStatus;
  code?: string;
}

export interface SessionData {
  room: string;
  tokenHashes: { A: string; B: string | null };
  createdAt: number;
  expiresAt: string;
  states: { A: ParticipantState; B: ParticipantState };
  transcripts: { A: string | null; B: string | null };
  confirmedText: { A: string | null; B: string | null };
  confirmedRevision: { A: number; B: number };
  consent: { A: boolean; B: boolean };
  sessionState: SessionState;
  generationId: string | null;
  // Private model output - strictly server side
  analystResults: { A: AnalystOutput | null; B: AnalystOutput | null };
  // Public shared outputs
  sharedResult: MediatorResult | null;
  verdictText: string | null;
  outcome: Outcome | null;
  audioManifest: AudioManifest | null;
  audioCache: Map<number, CachedAudioClip>;
  // Active socket connections
  sockets: { A: WebSocket | null; B: WebSocket | null };
  // Active job controllers for cancellation
  activeControllers: Set<AbortController>;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
