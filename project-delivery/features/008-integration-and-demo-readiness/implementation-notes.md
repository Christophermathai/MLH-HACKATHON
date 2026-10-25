# Integration, failure recovery, and demo readiness: implementation notes

- Created `app/api/src/integration.test.ts`:
  - Validates complete two-participant journey across room creation, side claims, WebSocket connections, typed/speech transcript input, consent gating, mediator output, judge streaming, and TTS delivery.
  - Validates security boundaries: double-claim of Side B rejected with `409 SIDE_TAKEN`; invalid resume token rejected with `UNAUTHORIZED`.
  - Validates reconnection recovery: authoritative state and cached audio manifest returned in `session_snapshot`; `replay_audio` delivers all clips in sequence without re-synthesizing.
- Created `docs/demo-runbook.md`:
  - 3-minute hackathon demo script with timeline (0:00 to 3:00), roles, Malayalam/English dialog, and offline fallback procedures.
- Created `project-delivery/features/008-integration-and-demo-readiness/verification.md`:
  - Full verification matrix and GO decision for demo deployment.
- Re-architected root routing in `app/frontend/src/app/page.tsx` and `app/frontend/src/app/lab/page.tsx`:
  - Root `/` now directly serves the actual ZoomOut Court Application (`SessionView`).
  - Model Lab is preserved at `/lab`.
