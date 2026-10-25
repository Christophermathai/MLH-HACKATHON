import { WebSocket } from "ws";
import {
  Side,
  ServerEventType,
  createServerMessage,
  SessionSnapshot,
  assertNoPrivateDataInSnapshot,
} from "@zoomout/contracts";
import { SessionData } from "../sessions/sessionTypes.js";

export function projectSnapshot(session: SessionData, side: Side): SessionSnapshot {
  const snapshot: SessionSnapshot = {
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
    // Consent-gated shared output
    sharedResult: session.consent.A && session.consent.B ? session.sharedResult : null,
    verdictText: session.consent.A && session.consent.B ? session.verdictText : null,
    outcome: session.outcome,
    audioManifest: session.audioManifest,
  };

  assertNoPrivateDataInSnapshot(snapshot as any);
  return snapshot;
}

export function sendToSide<T extends ServerEventType>(
  session: SessionData,
  side: Side,
  type: T,
  payload: any,
  requestId?: string
): void {
  const socket = session.sockets[side];
  if (socket && socket.readyState === WebSocket.OPEN) {
    const msg = JSON.stringify(createServerMessage(type, payload, requestId));
    socket.send(msg);
  }
}

export function broadcast<T extends ServerEventType>(
  session: SessionData,
  type: T,
  payload: any,
  requestId?: string
): void {
  const msg = JSON.stringify(createServerMessage(type, payload, requestId));
  for (const side of ["A", "B"] as const) {
    const socket = session.sockets[side];
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg);
    }
  }
}
