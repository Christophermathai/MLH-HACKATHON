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
- Remaining work: P2 (Gate and route generation), P3 (Recover and clean up).

## Resume pointer

Read [status.md](status.md) and start with its next action. Proposed source paths in plan.md are not existing files. Preserve unrelated working-tree changes when implementation begins.
