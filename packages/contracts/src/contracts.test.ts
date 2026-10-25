import test from "node:test";
import assert from "node:assert/strict";
import {
  parseClientMessage,
  parseServerMessage,
  createClientMessage,
  createServerMessage,
  AnalystSchema,
  MediatorSchema,
  SafetyResultSchema,
  SessionSnapshotSchema,
  assertNoPrivateDataInSnapshot,
  CreateRoomResponseSchema,
  ClaimParticipantRequestSchema,
  ClaimParticipantResponseSchema,
  AudioManifestSchema,
  ZoomOutPublicError,
  devanagariToMalayalam,
} from "./index.js";

test("devanagariToMalayalam converts Devanagari phonetics to Malayalam script", () => {
  const devanagariText = "अगने साम्पोच्छते नल्लतिन आबु.";
  const malayalamText = devanagariToMalayalam(devanagariText);
  assert.equal(malayalamText, "അഗനെ സാമ്പോച്ഛതെ നല്ലതിന് ആബു.");
});

test("AC-002-02: Valid client and server messages parse with versioned envelope", () => {
  const clientJoin = createClientMessage("join", {
    room: "ABCD1234",
    side: "A",
    resumeToken: "abcdef1234567890abcdef1234567890",
  }, "00000000-0000-0000-0000-000000000001");

  const parsedClient = parseClientMessage(JSON.stringify(clientJoin));
  assert.equal(parsedClient.type, "join");
  assert.equal(parsedClient.payload.room, "ABCD1234");
  assert.equal(parsedClient.requestId, "00000000-0000-0000-0000-000000000001");

  const serverDelta = createServerMessage("verdict_text_delta", {
    text: "Court is now in session.",
  });
  const parsedServer = parseServerMessage(JSON.stringify(serverDelta));
  assert.equal(parsedServer.type, "verdict_text_delta");
  assert.equal(parsedServer.payload.text, "Court is now in session.");
});

test("AC-002-02: Swapped direction fixtures fail deterministically", () => {
  // Client trying to send server event
  const clientSendingSnapshot = {
    v: 1,
    type: "session_snapshot",
    payload: {
      room: "ABCD1234",
      side: "A",
      expiresAt: new Date().toISOString(),
      ownState: "IDLE",
      ownText: null,
      ownConfirmed: false,
      ownConsent: false,
      readiness: { A: false, B: false },
      sessionState: "CREATED",
      generationId: null,
    },
  };

  assert.throws(
    () => parseClientMessage(JSON.stringify(clientSendingSnapshot)),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_EVENT" && err.message.includes("Direction violation")
  );

  // Server trying to send client event
  const serverSendingJoin = {
    v: 1,
    type: "join",
    payload: {
      room: "ABCD1234",
      side: "A",
      resumeToken: "abcdef1234567890abcdef1234567890",
    },
  };

  assert.throws(
    () => parseServerMessage(JSON.stringify(serverSendingJoin)),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_EVENT" && err.message.includes("Direction violation")
  );
});

test("AC-002-03: Bootstrap, participant claim, and snapshot schemas validate", () => {
  const expiresAt = new Date(Date.now() + 1800000).toISOString();

  // Create room response
  const createRoom = CreateRoomResponseSchema.parse({
    room: "ABCD1234",
    side: "A",
    resumeToken: "abcdef1234567890abcdef1234567890",
    expiresAt,
  });
  assert.equal(createRoom.side, "A");

  // Claim B request & response
  const claimReq = ClaimParticipantRequestSchema.parse({ side: "B" });
  assert.equal(claimReq.side, "B");

  const claimRes = ClaimParticipantResponseSchema.parse({
    room: "ABCD1234",
    side: "B",
    resumeToken: "1234567890abcdef1234567890abcdef",
    expiresAt,
  });
  assert.equal(claimRes.side, "B");

  // Invalid room code length
  assert.throws(() => {
    CreateRoomResponseSchema.parse({
      room: "SHORT",
      side: "A",
      resumeToken: "abcdef1234567890abcdef1234567890",
      expiresAt,
    });
  });
});

test("AC-002-04: Model validation rejects invalid scores, missing safety flags, and requires_apology:true", () => {
  // Valid analyst
  const validAnalyst = AnalystSchema.parse({
    side: "A",
    upset_about: ["Dishes left in sink"],
    stated_facts: ["Dishes were there at 8 AM"],
    assumptions_made: ["They expect me to clean them"],
    possible_feelings: ["Unappreciated"],
    unclear_lines: [],
    safety_flags: {
      abuse_or_coercion_signals: false,
      notes: "",
    },
  });
  assert.equal(validAnalyst.side, "A");

  // Missing safety_flags fails
  assert.throws(() => {
    AnalystSchema.parse({
      side: "A",
      upset_about: ["Dishes"],
      stated_facts: [],
      assumptions_made: [],
      possible_feelings: [],
      unclear_lines: [],
    });
  });

  // Valid mediator
  const validMediator = MediatorSchema.parse({
    what_each_is_upset_about: {
      A: ["Dishes in sink"],
      B: ["Micromanagement"],
    },
    where_interpretations_differ: ["Whether dishes needed immediate washing"],
    petty_score: 4,
    zoom_out: {
      immediate_issue: "Dirty plate",
      possible_underlying_feelings: ["Fatigue after long day"],
      bigger_picture: "Both want respect for their time",
    },
    truce: {
      next_step: "Rinse immediately, wash within 2 hours",
      requires_apology: false,
    },
  });
  assert.equal(validMediator.petty_score, 4);

  // Invalid petty_score > 10 fails
  assert.throws(() => {
    MediatorSchema.parse({
      ...validMediator,
      petty_score: 11,
    });
  });

  // Invalid petty_score < 0 fails
  assert.throws(() => {
    MediatorSchema.parse({
      ...validMediator,
      petty_score: -1,
    });
  });

  // requires_apology: true fails
  assert.throws(() => {
    MediatorSchema.parse({
      ...validMediator,
      truce: {
        next_step: "Say sorry",
        requires_apology: true as any,
      },
    });
  });
});

test("AC-002-04: Public snapshot enforces privacy projection", () => {
  const snapshotData = {
    room: "ABCD1234",
    side: "A" as const,
    expiresAt: new Date().toISOString(),
    ownState: "READY" as const,
    ownText: "My side of the story",
    ownConfirmed: true,
    ownConsent: true,
    readiness: { A: true, B: true },
    sessionState: "DONE" as const,
    generationId: "gen-123",
  };

  const parsedSnapshot = SessionSnapshotSchema.parse(snapshotData);
  assertNoPrivateDataInSnapshot(parsedSnapshot);

  // If someone attaches private analyst notes to snapshot, assertNoPrivateDataInSnapshot throws
  const pollutedSnapshot: any = {
    ...snapshotData,
    analyst_notes: "Private feelings",
  };
  assert.throws(() => assertNoPrivateDataInSnapshot(pollutedSnapshot));
});

test("AC-002-06: Manifest contracts handle success, one failed sentence, and all-audio failure", () => {
  // 1. Success
  const successManifest = AudioManifestSchema.parse({
    totalSentences: 3,
    textComplete: true,
    entries: [
      { seq: 0, status: "ready" },
      { seq: 1, status: "ready" },
      { seq: 2, status: "ready" },
    ],
  });
  assert.equal(successManifest.entries.length, 3);
  assert.ok(successManifest.entries.every((e) => e.status === "ready"));

  // 2. One failed sentence resolved as gap
  const partialManifest = AudioManifestSchema.parse({
    totalSentences: 3,
    textComplete: true,
    entries: [
      { seq: 0, status: "ready" },
      { seq: 1, status: "failed", code: "TTS_FAILED" },
      { seq: 2, status: "ready" },
    ],
  });
  assert.equal(partialManifest.entries[1].status, "failed");
  assert.equal(partialManifest.entries[1].code, "TTS_FAILED");

  // 3. All-audio failure (text complete, outcome: verdict with all audio failed)
  const allAudioFailedManifest = AudioManifestSchema.parse({
    totalSentences: 3,
    textComplete: true,
    entries: [
      { seq: 0, status: "failed", code: "TTS_UNAVAILABLE" },
      { seq: 1, status: "failed", code: "TTS_UNAVAILABLE" },
      { seq: 2, status: "failed", code: "TTS_UNAVAILABLE" },
    ],
  });
  assert.ok(allAudioFailedManifest.entries.every((e) => e.status === "failed"));
});

test("EC-002-01: Malformed JSON and oversized payloads are rejected safely", () => {
  assert.throws(
    () => parseClientMessage("invalid-json{"),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_EVENT"
  );

  const oversized = JSON.stringify({
    v: 1,
    type: "confirm_transcript",
    payload: {
      text: "x".repeat(70000),
      consent: true,
    },
  });

  assert.throws(
    () => parseClientMessage(oversized),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "LIMIT_EXCEEDED"
  );
});
