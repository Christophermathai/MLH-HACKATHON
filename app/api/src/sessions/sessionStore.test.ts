import test from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "./sessionStore.js";
import { transitionParticipant } from "./stateMachine.js";
import { ZoomOutPublicError } from "@zoomout/contracts";

test("AC-003-01: Room creation, token hashing, and atomic B claims", () => {
  const store = new SessionStore();
  const roomA = store.createRoom();

  assert.equal(roomA.side, "A");
  assert.equal(roomA.room.length, 8);
  assert.ok(roomA.resumeToken);

  const session = store.getSession(roomA.room);
  assert.ok(session);
  // Assert raw token is not stored, only its hash
  assert.notEqual(session.tokenHashes.A, roomA.resumeToken);
  assert.equal(session.tokenHashes.B, null);

  // Claim Side B first time succeeds
  const roomB = store.claimSideB(roomA.room);
  assert.equal(roomB.side, "B");
  assert.equal(roomB.room, roomA.room);
  assert.ok(roomB.resumeToken);
  assert.notEqual(session.tokenHashes.B, roomB.resumeToken);

  // Simultaneous/repeated Side B claim fails with SIDE_TAKEN
  assert.throws(
    () => store.claimSideB(roomA.room),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "SIDE_TAKEN"
  );

  // Caller with room code and wrong token fails authentication
  assert.throws(
    () => store.validateToken(roomA.room, "A", "wrong-token-1234567890abcdef1234567890abcdef"),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "UNAUTHORIZED"
  );

  // Valid tokens authenticate successfully
  const validA = store.validateToken(roomA.room, "A", roomA.resumeToken);
  assert.equal(validA.room, roomA.room);

  const validB = store.validateToken(roomA.room, "B", roomB.resumeToken);
  assert.equal(validB.room, roomA.room);
});

test("AC-003-02: Independent side state machines and invalid transition protection", () => {
  const store = new SessionStore();
  const roomA = store.createRoom();
  store.claimSideB(roomA.room);
  const session = store.getSession(roomA.room)!;

  // A starts recording
  transitionParticipant(session, "A", "RECORDING");
  assert.equal(session.states.A, "RECORDING");
  assert.equal(session.states.B, "IDLE"); // B is unaffected

  // B starts typed input (enters REVIEW) while A is recording
  transitionParticipant(session, "B", "REVIEW");
  assert.equal(session.states.A, "RECORDING");
  assert.equal(session.states.B, "REVIEW");

  // A finishes recording -> TRANSCRIBING
  transitionParticipant(session, "A", "TRANSCRIBING");
  assert.equal(session.states.A, "TRANSCRIBING");
  assert.equal(session.states.B, "REVIEW");

  // Invalid transition: B cannot go from REVIEW directly to TRANSCRIBING
  assert.throws(
    () => transitionParticipant(session, "B", "TRANSCRIBING"),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "INVALID_STATE"
  );
});

test("AC-003-03: Immutable confirmation and idempotent duplicate handling", () => {
  const store = new SessionStore();
  const roomA = store.createRoom();
  const session = store.getSession(roomA.room)!;

  transitionParticipant(session, "A", "REVIEW");

  // 1. First confirmation succeeds
  const first = store.confirmParticipant(session, "A", "He leaves plates in sink.", true);
  assert.equal(first.isFirstConfirmation, true);
  assert.equal(session.states.A, "READY");
  assert.equal(session.confirmedRevision.A, 1);
  assert.equal(session.confirmedText.A, "He leaves plates in sink.");

  // 2. Duplicate identical confirmation is idempotent no-op
  const duplicate = store.confirmParticipant(session, "A", "He leaves plates in sink.", true);
  assert.equal(duplicate.isFirstConfirmation, false);
  assert.equal(session.confirmedRevision.A, 1);

  // 3. Changed text after confirmation throws CONFIRMATION_LOCKED
  assert.throws(
    () => store.confirmParticipant(session, "A", "Actually, I did it.", true),
    (err: any) => err instanceof ZoomOutPublicError && err.code === "CONFIRMATION_LOCKED"
  );

  // Stored confirmed text and consent remain unchanged
  assert.equal(session.confirmedText.A, "He leaves plates in sink.");
  assert.equal(session.consent.A, true);
});
