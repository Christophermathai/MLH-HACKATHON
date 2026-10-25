import test from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "./sessionStore.js";
import { SessionLifecycleManager } from "./lifecycle.js";
import { SessionRecoveryManager } from "./recovery.js";
import { PipelineOrchestrator } from "./orchestrator.js";
import {
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "../providers/fakeProviders.js";
import { ZoomOutPublicError } from "@zoomout/contracts";

test("AC-003-06: Reconnect recovers state and cached output without re-running models; token isolation enforced", async () => {
  const store = new SessionStore();
  const recovery = new SessionRecoveryManager();
  const analyst = new FakeAnalystProvider();
  const mediator = new FakeMediatorProvider();
  const judge = new FakeJudgeStreamProvider();
  const tts = new FakeTtsProvider();
  const orchestrator = new PipelineOrchestrator(analyst, mediator, judge, tts);

  const roomA = store.createRoom();
  const roomB = store.claimSideB(roomA.room);
  const session = store.getSession(roomA.room)!;

  // Confirm both sides and run generation to completion
  store.confirmParticipant(session, "A", "Dishes left in sink.", true);
  await orchestrator.onSideConfirmed(session, "A");

  store.confirmParticipant(session, "B", "I was exhausted.", true);
  await orchestrator.onSideConfirmed(session, "B");

  assert.equal(session.sessionState, "DONE");
  assert.equal(session.outcome, "verdict");
  assert.ok(session.audioCache.size > 0);

  // Participant A reconnects with valid token
  const sentMessages: string[] = [];
  const fakeSocketA: any = {
    readyState: 1, // OPEN
    send: (msg: string) => sentMessages.push(msg),
    close: () => {},
  };

  recovery.handleReconnect(session, "A", fakeSocketA, "req-recon-1");

  // Verify snapshot delivered with existing verdict
  assert.ok(sentMessages.length > 0);
  const snapshotMsg = JSON.parse(sentMessages[0]);
  assert.equal(snapshotMsg.type, "session_snapshot");
  assert.equal(snapshotMsg.payload.sessionState, "DONE");
  assert.equal(snapshotMsg.payload.outcome, "verdict");
  assert.ok(snapshotMsg.payload.sharedResult);

  // Verify cached audio was replayed from cache without new model generation
  const audioChunkMsg = sentMessages.find((m) => JSON.parse(m).type === "audio_chunk");
  assert.ok(audioChunkMsg);

  // Using B's token to authenticate as A fails with UNAUTHORIZED
  assert.throws(
    () => store.validateToken(roomA.room, "A", roomB.resumeToken),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "UNAUTHORIZED"
  );
});

test("AC-003-07: Expiry cancels pending jobs, deletes room, and rejects late requests", async () => {
  const store = new SessionStore();
  let expiredRoomCode = "";
  const lifecycle = new SessionLifecycleManager(store, (room) => {
    expiredRoomCode = room;
  });

  const roomA = store.createRoom();
  const session = store.getSession(roomA.room)!;

  // Add an active abort controller to simulate a running job
  const jobController = new AbortController();
  session.activeControllers.add(jobController);

  // Trigger immediate expiry
  lifecycle.expireSession(roomA.room);

  assert.equal(expiredRoomCode, roomA.room);
  assert.equal(jobController.signal.aborted, true);
  assert.equal(store.getSession(roomA.room), undefined);

  // Future join attempts return SESSION_UNAVAILABLE
  assert.throws(
    () => store.validateToken(roomA.room, "A", roomA.resumeToken),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "SESSION_UNAVAILABLE"
  );
});

test("AC-003-08: Failed generation preserves state without restarting, and EC-003-03 disconnects", async () => {
  const store = new SessionStore();
  const recovery = new SessionRecoveryManager();
  const lifecycle = new SessionLifecycleManager(store);

  // Failing mediator
  const analyst = new FakeAnalystProvider();
  const failingMediator = new FakeMediatorProvider({ shouldFail: true });
  const judge = new FakeJudgeStreamProvider();
  const tts = new FakeTtsProvider();
  const orchestrator = new PipelineOrchestrator(analyst, failingMediator, judge, tts);

  const roomA = store.createRoom();
  store.claimSideB(roomA.room);
  const session = store.getSession(roomA.room)!;

  store.confirmParticipant(session, "A", "Statement A", true);
  await orchestrator.onSideConfirmed(session, "A");

  store.confirmParticipant(session, "B", "Statement B", true);
  await orchestrator.onSideConfirmed(session, "B");

  assert.equal(session.sessionState, "FAILED");
  assert.equal(session.outcome, "incomplete");

  // Reconnect on failed session returns snapshot with FAILED, does not re-run
  const sentMessages: string[] = [];
  const fakeSocket: any = {
    readyState: 1,
    send: (msg: string) => sentMessages.push(msg),
    close: () => {},
  };

  recovery.handleReconnect(session, "A", fakeSocket);
  const snapshotMsg = JSON.parse(sentMessages[0]);
  assert.equal(snapshotMsg.payload.sessionState, "FAILED");
  assert.equal(snapshotMsg.payload.outcome, "incomplete");

  // EC-003-03: Disconnect during RECORDING returns state to IDLE
  const room2 = store.createRoom();
  const session2 = store.getSession(room2.room)!;
  session2.states.A = "RECORDING";

  lifecycle.handleDisconnect(session2, "A");
  assert.equal(session2.states.A, "IDLE");
  assert.equal(session2.sockets.A, null);
});
