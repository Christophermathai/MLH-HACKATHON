# Recording and transcription: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Frontend developer for capture; backend developer for STT.
Input research: [brainstorm](../../brainstorms/004-recording-and-transcription/brainstorm.md), [brainstorm sprint](../../brainstorms/004-recording-and-transcription/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns microphone lifecycle, input encoding, STT adapters, and raw-audio cleanup. 005 owns text editing and confirmation; 003 owns recipient binding and state.

Batch capture is the required MVP path; PCM streaming is an explicit extension phase. Limit recordings to 60 seconds and 5 MiB total with 32 KiB frames. Encoded batch MIME must match a configuration validated in 001; unsupported browser/provider combinations go to typed input. Use 60-second batch and 15-second streaming-inactivity deadlines.

Dependencies: [001-speech-provider-feasibility](../001-speech-provider-feasibility/status.md), [002-foundation-and-contracts](../002-foundation-and-contracts/status.md), [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/status.md)

Critical path: 001 provider evidence + 002 contracts + 003 sessions -> P1 batch capture -> P2 cleanup/failure handling. P3 streaming is optional and is not on the batch-MVP critical path.

Riskiest work: Implement batch capture; Add failure handling and cleanup; Add optional streaming input. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Implement batch capture

Goal: implement batch capture and satisfy FR-004-01, FR-004-02, FR-004-03.
Risk: High.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `app/frontend/src/features/recording/`, `app/api/src/providers/stt/`, `app/api/src/audio/input.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Build record controls, permission handling, and typed escape.
2. Implement declared encoded-MIME capture and gateway frame/recording limits.
3. Connect the selected batch adapter with final transcript delivery.

Verification: Use fake microphone/provider data for limits and side routing, then one verified live batch clip; record live checks as blocked without 001 evidence.
Acceptance IDs: AC-004-01, AC-004-02, AC-004-03. Also exercise all related edge cases in spec.md.

Avoid: Do not pass WebM/Opus bytes to a PCM API or start analysis from unconfirmed STT output.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Add failure handling and cleanup

Goal: add failure handling and cleanup and satisfy FR-004-06, FR-004-07, FR-004-08.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/frontend/src/features/recording/`, `app/api/src/providers/stt/`, `app/api/tests/stt/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Handle silence, uncertainty, deadlines, retry, and late-result guards.
2. Implement cleanup for all client/server lifecycle exits.
3. Verify typed handoff and private transcript projection.

Verification: Inject silence, timeout, cancel, disconnect, and expiry; inspect microphone state and app-owned buffer references.
Acceptance IDs: AC-004-06, AC-004-07, AC-004-08. Also exercise all related edge cases in spec.md.

Avoid: Do not retain full raw recordings in logs, cache, database, or browser storage.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Add optional streaming input

Goal: add optional streaming input and satisfy FR-004-04, FR-004-05.
Risk: High.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase. This is optional streaming scope; record DEFERRED if the batch MVP ships first.

Files to create/modify (proposed): `app/frontend/public/worklets/`, `app/frontend/src/audio/resample.ts`, `app/api/src/providers/stt/stream.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Implement AudioWorklet capture and rate conversion with PCM frame checks.
2. Forward partials privately and finalize on stop.
3. On provider stream failure, keep the bounded recording for one batch retry; document when this phase is deferred.

Verification: Test sample-rate conversion, chunk duration, stream failure at different offsets, and single finalization.
Acceptance IDs: AC-004-04, AC-004-05. Also exercise all related edge cases in spec.md.

Avoid: Do not call the full streaming feature complete if this explicitly optional phase is deferred.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-004-01 | AC-004-01 | P1 | Not implemented / not run |
| FR-004-02 | AC-004-02 | P1 | Not implemented / not run |
| FR-004-03 | AC-004-03 | P1 | Not implemented / not run |
| FR-004-04 | AC-004-04 | P3 | Not implemented / not run |
| FR-004-05 | AC-004-05 | P3 | Not implemented / not run |
| FR-004-06 | AC-004-06 | P2 | Not implemented / not run |
| FR-004-07 | AC-004-07 | P2 | Not implemented / not run |
| FR-004-08 | AC-004-08 | P2 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Browser/provider codec compatibility requires unit 001 evidence and a real-device check. Optional streaming is separately tracked so batch MVP completion does not imply streaming completion.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 004-recording-and-transcription. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
