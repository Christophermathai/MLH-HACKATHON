import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { AudioReceiver } from "./audioReceiver.js";
import { FakeSttProvider } from "../providers/fakeProviders.js";
import { SessionData } from "../sessions/sessionTypes.js";
import { LIMITS, ZoomOutPublicError } from "@zoomout/contracts";

function createMockSession(room = "AUDI0001"): SessionData {
  return {
    room,
    tokenHashes: { A: "hashA", B: "hashB" },
    createdAt: Date.now(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
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
}

class MockSocket {
  public messages: string[] = [];
  public readyState = WebSocket.OPEN;
  public send(msg: string) {
    this.messages.push(msg);
  }
  public getParsedMessages() {
    return this.messages.map((m) => JSON.parse(m));
  }
}

test("AC-004-02: startRecording rejects unsupported audio MIME types", () => {
  const fakeStt = new FakeSttProvider();
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();

  assert.throws(
    () => {
      receiver.startRecording(session, "A", {
        mode: "batch",
        mime: "audio/unsupported-codec",
      });
    },
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_AUDIO"
  );
  assert.equal(session.states.A, "IDLE");
});

test("AC-004-02: startRecording rejects MediaRecorder batch labeled as PCM", () => {
  const fakeStt = new FakeSttProvider();
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();

  assert.throws(
    () => {
      receiver.startRecording(session, "A", {
        mode: "batch",
        mime: "audio/webm;pcm=true",
      });
    },
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_AUDIO"
  );
});

test("AC-004-02: handleAudioChunk enforces MAX_AUDIO_FRAME_BYTES (32 KiB limit)", async () => {
  const fakeStt = new FakeSttProvider();
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();
  const socketA = new MockSocket();
  session.sockets.A = socketA as any;

  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  assert.equal(session.states.A, "RECORDING");

  // Send chunk larger than 32 KiB
  const oversizedChunk = Buffer.alloc(LIMITS.MAX_AUDIO_FRAME_BYTES + 1);
  await receiver.handleAudioChunk(session, "A", oversizedChunk);

  assert.equal(session.states.A, "IDLE");
  const messages = socketA.getParsedMessages();
  const errorMsg = messages.find((m) => m.type === "error");
  assert.ok(errorMsg);
  assert.equal(errorMsg.payload.code, "LIMIT_EXCEEDED");
  assert.equal(errorMsg.payload.fallback, "typed_input");
});

test("AC-004-02: handleAudioChunk enforces MAX_AUDIO_TOTAL_BYTES (5 MiB total limit)", async () => {
  const fakeStt = new FakeSttProvider();
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();
  const socketA = new MockSocket();
  session.sockets.A = socketA as any;

  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });

  // Send chunks accumulating up to > 5 MiB
  const chunkSize = LIMITS.MAX_AUDIO_FRAME_BYTES; // 32 KiB
  const chunksNeeded = Math.ceil(LIMITS.MAX_AUDIO_TOTAL_BYTES / chunkSize) + 1;
  const chunk = Buffer.alloc(chunkSize);

  for (let i = 0; i < chunksNeeded; i++) {
    await receiver.handleAudioChunk(session, "A", chunk);
    if (session.states.A !== "RECORDING") break;
  }

  assert.equal(session.states.A, "IDLE");
  const messages = socketA.getParsedMessages();
  const errorMsg = messages.find((m) => m.type === "error");
  assert.ok(errorMsg);
  assert.equal(errorMsg.payload.code, "LIMIT_EXCEEDED");
});

test("AC-004-03: successful batch recording produces final_transcript for owner only and transitions to REVIEW", async () => {
  const fakeStt = new FakeSttProvider({
    text: "അവൻ എല്ലാ ദിവസവും വൈകിയാണ് വരുന്നത്.",
  });
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();

  const socketA = new MockSocket();
  const socketB = new MockSocket();
  session.sockets.A = socketA as any;
  session.sockets.B = socketB as any;

  // Participant A records
  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  assert.equal(session.states.A, "RECORDING");
  assert.equal(session.states.B, "IDLE");

  // Send valid audio frames
  await receiver.handleAudioChunk(session, "A", Buffer.alloc(4096, 1));
  await receiver.handleAudioChunk(session, "A", Buffer.alloc(4096, 2));

  // Stop recording
  await receiver.stopRecording(session, "A");

  // A enters REVIEW with transcript
  assert.equal(session.states.A, "REVIEW");
  assert.equal(session.transcripts.A, "അവൻ എല്ലാ ദിവസവും വൈകിയാണ് വരുന്നത്.");

  // Verify A received recording_started and final_transcript
  const msgsA = socketA.getParsedMessages();
  assert.ok(msgsA.some((m) => m.type === "recording_started"));
  const finalMsgA = msgsA.find((m) => m.type === "final_transcript");
  assert.ok(finalMsgA);
  assert.equal(finalMsgA.payload.text, "അവൻ എല്ലാ ദിവസവും വൈകിയാണ് വരുന്നത്.");

  // Verify B received NOTHING
  assert.equal(socketB.messages.length, 0);
  assert.equal(session.transcripts.B, null);
  assert.equal(session.states.B, "IDLE");

  // No analyst has run (analyst only triggers upon confirm)
  assert.equal(session.analystResults.A, null);
  assert.equal(session.analystResults.B, null);
});

test("AC-004-06: silence or empty recognition returns editable placeholder and enters REVIEW", async () => {
  const fakeStt = new FakeSttProvider({ text: "" });
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();
  const socketA = new MockSocket();
  session.sockets.A = socketA as any;

  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  await receiver.handleAudioChunk(session, "A", Buffer.alloc(1024, 0));
  await receiver.stopRecording(session, "A");

  assert.equal(session.states.A, "REVIEW");
  assert.equal(session.transcripts.A, "[ശബ്ദം വ്യക്തമല്ല / No speech detected]");
  assert.equal(session.consent.A, false); // No consent granted automatically

  const msgsA = socketA.getParsedMessages();
  const finalMsg = msgsA.find((m) => m.type === "final_transcript");
  assert.ok(finalMsg);
  assert.equal(finalMsg.payload.text, "[ശബ്ദം വ്യക്തമല്ല / No speech detected]");
});

test("AC-004-07: cancelRecording discards buffers and returns participant to IDLE", async () => {
  const fakeStt = new FakeSttProvider();
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();

  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  await receiver.handleAudioChunk(session, "A", Buffer.alloc(2048));
  assert.ok(receiver.getActiveRecording(session.room, "A"));

  receiver.cancelRecording(session, "A");
  assert.equal(session.states.A, "IDLE");
  assert.equal(receiver.getActiveRecording(session.room, "A"), undefined);
});

test("AC-004-08: new recording attempt invalidates stale in-flight STT from previous attempt", async () => {
  // Provider with delay to simulate long in-flight transcription
  const fakeStt = new FakeSttProvider({
    text: "OLD STALE RESULT",
    delayMs: 50,
  });
  const receiver = new AudioReceiver(fakeStt);
  const session = createMockSession();
  const socketA = new MockSocket();
  session.sockets.A = socketA as any;

  // First recording attempt
  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  await receiver.handleAudioChunk(session, "A", Buffer.alloc(1024));

  // Stop begins in-flight STT
  const promise1 = receiver.stopRecording(session, "A");

  // User decides to cancel/retry while in-flight
  receiver.cancelRecording(session, "A");
  assert.equal(session.states.A, "IDLE");

  // Second recording attempt
  receiver.startRecording(session, "A", {
    mode: "batch",
    mime: "audio/webm;codecs=opus",
  });
  assert.equal(session.states.A, "RECORDING");

  // Wait for promise1 to finish
  await promise1;

  // The stale old result MUST NOT have updated transcript or entered review
  assert.equal(session.states.A, "RECORDING");
  assert.notEqual(session.transcripts.A, "OLD STALE RESULT");

  receiver.cleanupRecording(session.room, "A");
});
