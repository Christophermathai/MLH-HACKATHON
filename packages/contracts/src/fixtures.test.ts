import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseClientMessage,
  parseServerMessage,
  AnalystSchema,
  MediatorSchema,
  SessionSnapshotSchema,
  CreateRoomResponseSchema,
  ClaimParticipantRequestSchema,
  ClaimParticipantResponseSchema,
  AudioManifestSchema,
  assertNoPrivateDataInSnapshot,
} from "./index.js";

const FIXTURES_DIR = path.resolve(process.cwd(), "../../tests/fixtures/events");

test("fixtures: client fixtures validate or fail as expected", () => {
  const validJoin = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/join-valid.json"), "utf8"));
  assert.equal(parseClientMessage(validJoin).type, "join");

  const batchRec = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/start-recording-batch.json"), "utf8"));
  assert.equal(parseClientMessage(batchRec).type, "start_recording");

  const streamRec = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/start-recording-streaming.json"), "utf8"));
  assert.equal(parseClientMessage(streamRec).type, "start_recording");

  const stopRec = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/stop-recording.json"), "utf8"));
  assert.equal(parseClientMessage(stopRec).type, "stop_recording");

  const validConfirm = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/confirm-transcript-valid.json"), "utf8"));
  assert.equal(parseClientMessage(validConfirm).type, "confirm_transcript");

  const invalidConfirm = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/confirm-transcript-invalid-consent.json"), "utf8"));
  assert.throws(() => parseClientMessage(invalidConfirm));

  const replay = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "client/replay-audio.json"), "utf8"));
  assert.equal(parseClientMessage(replay).type, "replay_audio");
});

test("fixtures: server fixtures validate as expected", () => {
  const files = [
    "recording-started.json",
    "partial-transcript.json",
    "final-transcript.json",
    "side-ready.json",
    "both-ready.json",
    "verdict-text-delta.json",
    "audio-chunk.json",
    "audio-status-ready.json",
    "audio-status-failed.json",
    "done-verdict.json",
    "done-safety.json",
    "done-incomplete.json",
    "error-sanitized.json",
  ];

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "server", file), "utf8"));
    const parsed = parseServerMessage(raw);
    assert.ok(parsed.type);
  }
});

test("fixtures: bootstrap fixtures validate", () => {
  const createRoom = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "bootstrap/create-room-response.json"), "utf8"));
  assert.equal(CreateRoomResponseSchema.parse(createRoom).side, "A");

  const claimReq = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "bootstrap/claim-participant-request.json"), "utf8"));
  assert.equal(ClaimParticipantRequestSchema.parse(claimReq).side, "B");

  const claimRes = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "bootstrap/claim-participant-response.json"), "utf8"));
  assert.equal(ClaimParticipantResponseSchema.parse(claimRes).side, "B");

  const snapshotInitial = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "bootstrap/session-snapshot-initial.json"), "utf8"));
  assert.equal(SessionSnapshotSchema.parse(snapshotInitial).ownState, "IDLE");
  assertNoPrivateDataInSnapshot(snapshotInitial);

  const snapshotDone = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "bootstrap/session-snapshot-done.json"), "utf8"));
  assert.equal(SessionSnapshotSchema.parse(snapshotDone).sessionState, "DONE");
  assertNoPrivateDataInSnapshot(snapshotDone);
});

test("fixtures: model fixtures validate or reject appropriately", () => {
  const validAnalyst = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/analyst-valid.json"), "utf8"));
  assert.equal(AnalystSchema.parse(validAnalyst).side, "A");

  const flaggedAnalyst = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/analyst-flagged-abuse.json"), "utf8"));
  assert.equal(AnalystSchema.parse(flaggedAnalyst).safety_flags.abuse_or_coercion_signals, true);

  const invalidAnalyst = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/analyst-invalid-missing-flags.json"), "utf8"));
  assert.throws(() => AnalystSchema.parse(invalidAnalyst));

  const validMediator = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/mediator-valid.json"), "utf8"));
  assert.equal(MediatorSchema.parse(validMediator).petty_score, 4);

  const invalidScore = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/mediator-invalid-score.json"), "utf8"));
  assert.throws(() => MediatorSchema.parse(invalidScore));

  const invalidApology = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "models/mediator-invalid-apology.json"), "utf8"));
  assert.throws(() => MediatorSchema.parse(invalidApology));
});

test("fixtures: audio manifest fixtures validate", () => {
  const manifestSuccess = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "audio/manifest-success.json"), "utf8"));
  assert.equal(AudioManifestSchema.parse(manifestSuccess).entries.length, 3);

  const manifestGap = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "audio/manifest-one-gap.json"), "utf8"));
  assert.equal(AudioManifestSchema.parse(manifestGap).entries[1].status, "failed");

  const manifestAllFailed = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "audio/manifest-all-failed.json"), "utf8"));
  assert.ok(AudioManifestSchema.parse(manifestAllFailed).entries.every((e: any) => e.status === "failed"));
});
