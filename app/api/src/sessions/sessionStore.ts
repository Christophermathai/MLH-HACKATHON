import crypto from "node:crypto";
import {
  LIMITS,
  Side,
  SessionSnapshot,
  ZoomOutPublicError,
} from "@zoomout/contracts";
import { SessionData, hashToken } from "./sessionTypes.js";
import { transitionParticipant } from "./stateMachine.js";

export class SessionStore {
  private sessions = new Map<string, SessionData>();

  constructor(private sessionLifetimeMs: number = LIMITS.SESSION_LIFETIME_MS) {}

  public getSession(roomCode: string): SessionData | undefined {
    const session = this.sessions.get(roomCode.toUpperCase());
    if (!session) {
      return undefined;
    }
    if (this.isExpired(session)) {
      this.deleteSession(session.room);
      return undefined;
    }
    return session;
  }

  public isExpired(session: SessionData, now: number = Date.now()): boolean {
    return now > session.createdAt + this.sessionLifetimeMs;
  }

  public createRoom(now: number = Date.now()): {
    room: string;
    side: "A";
    resumeToken: string;
    expiresAt: string;
  } {
    if (this.sessions.size >= LIMITS.MAX_ACTIVE_ROOMS) {
      throw new ZoomOutPublicError("CAPACITY", "Active room capacity reached (max 100)");
    }

    let roomCode = "";
    let attempts = 0;
    while (!roomCode || this.sessions.has(roomCode)) {
      attempts += 1;
      if (attempts > 100) {
        throw new ZoomOutPublicError("CAPACITY", "Failed to generate unique room code");
      }
      roomCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    }

    const resumeToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(resumeToken);
    const expiresAt = new Date(now + this.sessionLifetimeMs).toISOString();

    const session: SessionData = {
      room: roomCode,
      tokenHashes: { A: tokenHash, B: null },
      createdAt: now,
      expiresAt,
      states: { A: "IDLE", B: "IDLE" },
      transcripts: { A: null, B: null },
      confirmedText: { A: null, B: null },
      confirmedRevision: { A: 0, B: 0 },
      consent: { A: false, B: false },
      sessionState: "CREATED",
      generationId: null,
      analystResults: { A: null, B: null },
      sharedResult: null,
      verdictText: null,
      outcome: null,
      audioManifest: null,
      audioCache: new Map(),
      sockets: { A: null, B: null },
      activeControllers: new Set(),
    };

    this.sessions.set(roomCode, session);

    return {
      room: roomCode,
      side: "A",
      resumeToken,
      expiresAt,
    };
  }

  public claimSideB(
    roomCode: string,
    now: number = Date.now()
  ): {
    room: string;
    side: "B";
    resumeToken: string;
    expiresAt: string;
  } {
    const session = this.getSession(roomCode);
    if (!session || this.isExpired(session, now)) {
      throw new ZoomOutPublicError("SESSION_UNAVAILABLE", "Room not found or expired");
    }

    // Atomic claim check
    if (session.tokenHashes.B !== null) {
      throw new ZoomOutPublicError("SIDE_TAKEN", "Side B has already been claimed for this room.");
    }

    const resumeToken = crypto.randomBytes(32).toString("hex");
    session.tokenHashes.B = hashToken(resumeToken);

    return {
      room: session.room,
      side: "B",
      resumeToken,
      expiresAt: session.expiresAt,
    };
  }

  public validateToken(roomCode: string, side: Side, token: string, now: number = Date.now()): SessionData {
    const session = this.getSession(roomCode);
    if (!session || this.isExpired(session, now)) {
      throw new ZoomOutPublicError("SESSION_UNAVAILABLE", "Room not found or expired");
    }

    const expectedHash = session.tokenHashes[side];
    if (!expectedHash) {
      throw new ZoomOutPublicError("UNAUTHORIZED", `Side ${side} has not been claimed yet.`);
    }

    const providedHash = hashToken(token);
    if (providedHash !== expectedHash) {
      throw new ZoomOutPublicError("UNAUTHORIZED", "Invalid resume token for participant.");
    }

    return session;
  }

  public confirmParticipant(
    session: SessionData,
    side: Side,
    text: string,
    consent: boolean
  ): { isFirstConfirmation: boolean } {
    if (consent !== true) {
      throw new ZoomOutPublicError("BAD_EVENT", "Explicit consent:true is required to confirm transcript.");
    }

    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > LIMITS.MAX_TRANSCRIPT_CODE_POINTS) {
      throw new ZoomOutPublicError(
        "BAD_EVENT",
        `Transcript must be between 1 and ${LIMITS.MAX_TRANSCRIPT_CODE_POINTS} characters.`
      );
    }

    // Idempotent duplicate check
    if (session.confirmedRevision[side] === 1) {
      if (session.confirmedText[side] === trimmed) {
        return { isFirstConfirmation: false };
      }
      throw new ZoomOutPublicError(
        "CONFIRMATION_LOCKED",
        "Confirmed transcript revision 1 is locked and cannot be modified."
      );
    }

    if (session.states[side] !== "REVIEW") {
      transitionParticipant(session, side, "REVIEW");
    }

    transitionParticipant(session, side, "READY");

    session.confirmedText[side] = trimmed;
    session.transcripts[side] = trimmed;
    session.confirmedRevision[side] = 1;
    session.consent[side] = true;

    return { isFirstConfirmation: true };
  }

  public getSnapshot(session: SessionData, side: Side): SessionSnapshot {
    return {
      room: session.room,
      side,
      expiresAt: session.expiresAt,
      ownState: session.states[side],
      ownText: session.transcripts[side],
      ownConfirmed: session.confirmedRevision[side] === 1,
      ownConsent: session.consent[side],
      readiness: {
        A: session.confirmedRevision.A === 1 && session.consent.A,
        B: session.confirmedRevision.B === 1 && session.consent.B,
      },
      sessionState: session.sessionState,
      generationId: session.generationId,
      sharedResult: session.sharedResult,
      verdictText: session.verdictText,
      outcome: session.outcome,
      audioManifest: session.audioManifest,
    };
  }

  public deleteSession(roomCode: string): void {
    const code = roomCode.toUpperCase();
    const session = this.sessions.get(code);
    if (session) {
      // Abort any active jobs
      for (const controller of session.activeControllers) {
        controller.abort();
      }
      session.activeControllers.clear();
      // Close sockets
      try {
        session.sockets.A?.close();
      } catch {}
      try {
        session.sockets.B?.close();
      } catch {}
      session.audioCache.clear();
      this.sessions.delete(code);
    }
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }
}
