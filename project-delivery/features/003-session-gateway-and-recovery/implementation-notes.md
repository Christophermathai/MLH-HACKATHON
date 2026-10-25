# Session gateway, participant isolation, and recovery: implementation notes

## Current evidence

- Documentation prepared on 2026-10-25.
- Application changes: none.
- Provider calls and deployments: none.
- Runtime tests/builds: not run; application source and package manifests do not exist.
- Document checks and readiness findings: see [audit.md](audit.md).

## Inputs needed before live execution

The in-memory design cannot recover after process restart. Exactly-once orchestration is scoped to one live process/session; it does not guarantee provider-side billing exactly once after network uncertainty.

## Execution record

### 2026-10-25: Phase 1 (Build identity and state service)
- Files created/modified:
  - `app/api/src/sessions/sessionTypes.ts`: Data types for in-memory session, token hashing with SHA-256 (`hashToken`), participant states, and active controllers.
  - `app/api/src/sessions/stateMachine.ts`: `canTransition`, `transitionParticipant` enforcing strict independent progress (`IDLE` -> `RECORDING` -> `TRANSCRIBING` -> `REVIEW` -> `READY`) and rejecting illegal transitions with `INVALID_STATE` or `CONFIRMATION_LOCKED`.
  - `app/api/src/sessions/sessionStore.ts`: `SessionStore` with 8-character uppercase room codes, collision checks, token hashing, atomic Side B claim, token authentication, and immutable confirmation logic with revision 1 locking.
  - `app/api/src/sessions/sessionStore.test.ts`: Unit tests validating AC-003-01, AC-003-02, and AC-003-03.
- Requirements and Acceptance criteria:
  - FR-003-01 / AC-003-01: Cryptographically random 8-character room codes; 32-byte tokens; server stores only SHA-256 hashes. Simultaneous Side B claims result in exactly one winner; subsequent claim returns 409 `SIDE_TAKEN`.
  - FR-003-02 / AC-003-02: Side A and Side B progress tracked independently. Transitioning one side does not overwrite the other. Invalid transitions produce `INVALID_STATE`.
  - FR-003-03 / AC-003-03: Edited confirmation requires `consent: true`. Stored text locked at revision 1. Identical repeat confirmation is idempotent. Changed confirmed text returns `CONFIRMATION_LOCKED` without altering consent.
- Verification checks:
  - `npm run test --workspace=@zoomout/api`: 14/14 tests passing.
- Deviations: None.
- Remaining work: None; P1, P2, P3 complete.

### 2026-10-25: Phase 2 (Gate and route generation)
- Files created/modified:
  - `app/api/src/transport/projections.ts`: Projection helpers `projectSnapshot`, `sendToSide`, and `broadcast`. `projectSnapshot` guarantees participant isolation and ensures raw transcripts and private analyst JSON are never exposed.
  - `app/api/src/sessions/orchestrator.ts`: `PipelineOrchestrator` managing per-side background analysis upon confirmation, both-ready gating, exactly-once generation guard (`session.generationId`), safety trigger branching (skipping playful verdict for generic safety notice), mediator execution, judge streaming, and bounded concurrency (max 2) sentence-level TTS synthesis with audio caching.
  - `app/api/src/sessions/orchestrator.test.ts`: Tests validating AC-003-04 and AC-003-05.
- Requirements and Acceptance criteria:
  - FR-003-04 / AC-003-04: Mediation and judging are gated until both confirmations and both analyst runs complete. Exactly one generationId and one pipeline run are created even under concurrent callbacks. Serious safety flags abort playful mediation and emit generic calm safety result with 0 audio clips.
  - FR-003-05 / AC-003-05: Strict projection verified before and after consent. Neither participant snapshot nor outbound broadcast contains the other side's raw transcript or private analyst notes.
  - EC-003-01: When one side confirms, only own-side analyst runs; shared mediation stays strictly gated.
- Verification checks:
  - `npm run test --workspace=@zoomout/api`: 16/16 tests passing.
- Deviations: None.
- Remaining work: None.

### 2026-10-25: Phase 3 (Recover and clean up)
- Files created/modified:
  - `app/api/src/sessions/lifecycle.ts`: `SessionLifecycleManager` managing 30-minute absolute session expiry timers, graceful disposal of pending jobs and open sockets, and disconnect cleanup (resetting incomplete recordings to `IDLE` per EC-003-03).
  - `app/api/src/sessions/recovery.ts`: `SessionRecoveryManager` handling socket replacement on reconnect, delivery of authoritative snapshots, cached audio replay without re-running models, and client `replay_audio` requests.
  - `app/api/src/sessions/recovery.test.ts`: Unit tests validating AC-003-06, AC-003-07, AC-003-08, and EC-003-03.
  - `app/api/src/server.ts`: Integrated `SessionStore`, `SessionLifecycleManager`, `SessionRecoveryManager`, and `PipelineOrchestrator` into the HTTP/WebSocket gateway server.
- Requirements and Acceptance criteria:
  - FR-003-06 / AC-003-06: Reconnect using room, side, and matching token recovers authoritative state and cached output without re-running models. Using another participant's token fails authentication.
  - FR-003-07 / AC-003-07: Incomplete recordings are discarded on disconnect. Absolute 30-minute expiry cancels pending jobs, cleans up caches, and closes sockets; subsequent requests return `SESSION_UNAVAILABLE`.
  - FR-003-08 / AC-003-08: Failed generation preserves state without restarting models on reconnect.
- Verification checks:
  - `npm run test --workspace=@zoomout/api`: 19/19 tests passing.
  - `npm run test:e2e --workspace=@zoomout/api`: Smoke exchange passed.
- Deviations: None.
- Remaining work: Feature 003 implementation complete. Ready for Feature 004 (Recording and transcription).

## Resume pointer

Read [status.md](status.md) and start with its next action. Proposed source paths in plan.md are not existing files. Preserve unrelated working-tree changes when implementation begins.
