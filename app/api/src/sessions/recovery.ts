import { WebSocket } from "ws";
import { Side, createServerMessage } from "@zoomout/contracts";
import { SessionData } from "./sessionTypes.js";
import { projectSnapshot } from "../transport/projections.js";

export class SessionRecoveryManager {
  public handleReconnect(
    session: SessionData,
    side: Side,
    newSocket: WebSocket,
    requestId?: string
  ): void {
    // 1. Replace and close old socket if still active
    const oldSocket = session.sockets[side];
    if (oldSocket && oldSocket !== newSocket && oldSocket.readyState === WebSocket.OPEN) {
      try {
        oldSocket.close(1000, "Replaced by authenticated reconnect");
      } catch {}
    }

    session.sockets[side] = newSocket;

    // 2. Send authoritative snapshot
    const snapshot = projectSnapshot(session, side);
    const snapshotMsg = JSON.stringify(
      createServerMessage("session_snapshot", snapshot, requestId)
    );
    newSocket.send(snapshotMsg);

    // 3. Replay cached audio manifest and clips if generation is in progress or completed
    this.replayCachedOutput(session, side, newSocket);
  }

  public replayCachedOutput(session: SessionData, side: Side, targetSocket?: WebSocket): void {
    const socket = targetSocket ?? session.sockets[side];
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Only replay if audio is cached or manifest exists
    if (session.audioCache.size === 0 && !session.audioManifest) {
      return;
    }

    // Sort cached entries by seq ascending
    const sortedSeqs = Array.from(session.audioCache.keys()).sort((a, b) => a - b);

    for (const seq of sortedSeqs) {
      const clip = session.audioCache.get(seq);
      if (!clip) continue;

      if (clip.status === "ready") {
        socket.send(
          JSON.stringify(
            createServerMessage("audio_chunk", {
              seq: clip.seq,
              mime: clip.mime,
              data: clip.data,
              generationId: session.generationId ?? undefined,
            })
          )
        );
      }

      socket.send(
        JSON.stringify(
          createServerMessage("audio_status", {
            seq: clip.seq,
            status: clip.status,
            code: clip.code,
            generationId: session.generationId ?? undefined,
          })
        )
      );
    }

    if (session.audioManifest) {
      socket.send(
        JSON.stringify(
          createServerMessage("audio_manifest", session.audioManifest)
        )
      );
    }

    if (session.outcome) {
      socket.send(
        JSON.stringify(
          createServerMessage("done", {
            outcome: session.outcome,
            generationId: session.generationId ?? undefined,
          })
        )
      );
    }
  }
}
