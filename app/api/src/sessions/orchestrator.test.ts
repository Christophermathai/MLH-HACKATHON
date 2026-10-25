import test from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "./sessionStore.js";
import { PipelineOrchestrator } from "./orchestrator.js";
import {
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "../providers/fakeProviders.js";
import { projectSnapshot } from "../transport/projections.js";
import { assertNoPrivateDataInSnapshot } from "@zoomout/contracts";

test("AC-003-04: Orchestrator enforces exactly-once pipeline and handles safety trigger", async () => {
  const analyst = new FakeAnalystProvider();
  const mediator = new FakeMediatorProvider();
  const judge = new FakeJudgeStreamProvider();
  const tts = new FakeTtsProvider();

  const orchestrator = new PipelineOrchestrator(analyst, mediator, judge, tts);
  const store = new SessionStore();
  const roomA = store.createRoom();
  store.claimSideB(roomA.room);
  const session = store.getSession(roomA.room)!;

  // Confirm Side A
  store.confirmParticipant(session, "A", "Dishes were in the sink.", true);
  await orchestrator.onSideConfirmed(session, "A");

  // Only A confirmed: generation has not started yet
  assert.equal(session.generationId, null);
  assert.equal(session.sessionState, "CREATED");

  // Confirm Side B
  store.confirmParticipant(session, "B", "I came home exhausted.", true);
  await orchestrator.onSideConfirmed(session, "B");

  // Both confirmed: generation should have executed and completed
  assert.ok(session.generationId);
  const genId1 = session.generationId;
  assert.equal(session.sessionState, "DONE");
  assert.equal(session.outcome, "verdict");
  assert.ok(session.sharedResult);
  assert.ok(session.verdictText);

  // Duplicate callback: try starting again
  await orchestrator.tryStartMediation(session);
  // generationId does NOT change; exactly once!
  assert.equal(session.generationId, genId1);

  // Test Safety Trigger
  const abuseAnalyst = new FakeAnalystProvider({ abuseFlag: true });
  const safetyOrchestrator = new PipelineOrchestrator(abuseAnalyst, mediator, judge, tts);

  const room2 = store.createRoom();
  store.claimSideB(room2.room);
  const session2 = store.getSession(room2.room)!;

  store.confirmParticipant(session2, "A", "Normal disagreement", true);
  await safetyOrchestrator.onSideConfirmed(session2, "A");

  store.confirmParticipant(session2, "B", "Threats and coercion occurred", true);
  await safetyOrchestrator.onSideConfirmed(session2, "B");

  assert.equal(session2.outcome, "safety");
  assert.equal(session2.sessionState, "DONE");
  assert.equal(session2.sharedResult, null); // No mediator result created
  assert.equal(session2.verdictText, null); // No playful verdict created
  assert.equal(session2.audioManifest?.totalSentences, 0); // Zero audio generated
});

test("AC-003-05: Projections preserve privacy before and after consent", () => {
  const store = new SessionStore();
  const roomA = store.createRoom();
  store.claimSideB(roomA.room);
  const session = store.getSession(roomA.room)!;

  session.transcripts.A = "A's private account";
  session.transcripts.B = "B's private account";

  // 1. Snapshot for A before A confirms
  const snapshotA1 = projectSnapshot(session, "A");
  assert.equal(snapshotA1.ownText, "A's private account");
  assert.equal((snapshotA1 as any).otherText, undefined);
  assertNoPrivateDataInSnapshot(snapshotA1 as any);

  // 2. A confirms
  store.confirmParticipant(session, "A", "A's confirmed statement", true);
  const snapshotA2 = projectSnapshot(session, "A");
  assert.equal(snapshotA2.ownConfirmed, true);
  assert.equal(snapshotA2.readiness.A, true);
  assert.equal(snapshotA2.readiness.B, false);
  assert.equal(snapshotA2.sharedResult, null);
  assertNoPrivateDataInSnapshot(snapshotA2 as any);

  // 3. Both confirm and mediation produces shared result
  store.confirmParticipant(session, "B", "B's confirmed statement", true);
  session.sharedResult = {
    what_each_is_upset_about: { A: ["Dishes"], B: ["Nagging"] },
    where_interpretations_differ: ["Timing"],
    petty_score: 3,
    zoom_out: {
      immediate_issue: "Plates",
      possible_underlying_feelings: ["Fatigue"],
      bigger_picture: "Respect",
    },
    truce: { next_step: "Drink chai", requires_apology: false },
  };
  session.analystResults.A = {
    side: "A",
    upset_about: ["Dishes"],
    stated_facts: ["Dishes left"],
    assumptions_made: [],
    possible_feelings: [],
    unclear_lines: [],
    safety_flags: { abuse_or_coercion_signals: false, notes: "Private notes" },
  };

  const snapshotA3 = projectSnapshot(session, "A");
  assert.equal(snapshotA3.readiness.A, true);
  assert.equal(snapshotA3.readiness.B, true);
  assert.ok(snapshotA3.sharedResult);
  // Ensure private analyst notes are NEVER projected into public snapshot
  assert.equal((snapshotA3 as any).analystResults, undefined);
  assert.equal((snapshotA3 as any).analyst_notes, undefined);
  assertNoPrivateDataInSnapshot(snapshotA3 as any);
});
