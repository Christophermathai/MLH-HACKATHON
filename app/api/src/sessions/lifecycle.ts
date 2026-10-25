import { Side } from "@zoomout/contracts";
import { SessionData } from "./sessionTypes.js";
import { SessionStore } from "./sessionStore.js";

export class SessionLifecycleManager {
  private expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private store: SessionStore,
    private onExpired?: (room: string) => void
  ) {}

  public scheduleExpiry(session: SessionData, lifetimeMs?: number): void {
    this.cancelExpiry(session.room);
    const ms = lifetimeMs ?? Math.max(0, session.createdAt + 1800000 - Date.now());

    const timer = setTimeout(() => {
      this.expireSession(session.room);
    }, ms);

    // Unref timer so it does not block Node process exit in tests
    if (typeof timer.unref === "function") {
      timer.unref();
    }

    this.expiryTimers.set(session.room, timer);
  }

  public cancelExpiry(roomCode: string): void {
    const code = roomCode.toUpperCase();
    const existing = this.expiryTimers.get(code);
    if (existing) {
      clearTimeout(existing);
      this.expiryTimers.delete(code);
    }
  }

  public expireSession(roomCode: string): void {
    const code = roomCode.toUpperCase();
    this.cancelExpiry(code);
    this.store.deleteSession(code);
    this.onExpired?.(code);
  }

  public handleDisconnect(session: SessionData, side: Side): void {
    // If disconnected during an incomplete recording, discard capture & return to IDLE
    if (session.states[side] === "RECORDING") {
      session.states[side] = "IDLE";
      // Abort any active capture controller
      for (const controller of session.activeControllers) {
        controller.abort();
      }
    }

    // Detach socket reference
    session.sockets[side] = null;
  }

  public disposeAll(): void {
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
  }
}
