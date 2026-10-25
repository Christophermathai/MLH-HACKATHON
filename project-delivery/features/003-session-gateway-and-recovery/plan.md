# Session gateway, participant isolation, and recovery: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Backend developer.
Input research: [brainstorm](../../brainstorms/003-session-gateway-and-recovery/brainstorm.md), [brainstorm sprint](../../brainstorms/003-session-gateway-and-recovery/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns side binding, state transitions, event routing, lifecycle, and resume. 005 owns consent UX; 006 owns the analysis pipeline; 007 owns audio manifests and cache contents.

Use the shared contract's create/claim/join flow, 30-minute absolute session lifetime, and per-side opaque resume token. One active socket per side; successful authenticated reconnect replaces the old socket. Server restart loses in-memory sessions and requires a new room.

Dependencies: [002-foundation-and-contracts](../002-foundation-and-contracts/status.md)

Critical path: 002 -> P1 -> P2 -> P3.

Riskiest work: Build identity and state service; Gate and route generation; Recover and clean up. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Build identity and state service

Goal: build identity and state service and satisfy FR-003-01, FR-003-02, FR-003-03.
Risk: High.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `app/api/src/sessions/`, `app/api/src/transport/`, `app/api/tests/sessions/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Implement room code/token issuance, hashed binding, and atomic B claim.
2. Define separate side state machines and shared session transitions.
3. Implement immutable confirmation and idempotent duplicate handling.

Verification: Unit-test claim races, independent side transitions, bad credentials, duplicate confirmation, and changed confirmed text.
Acceptance IDs: AC-003-01, AC-003-02, AC-003-03. Also exercise all related edge cases in spec.md.

Avoid: Do not authorize from side labels alone or model A and B as one serial recording state.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Gate and route generation

Goal: gate and route generation and satisfy FR-003-04, FR-003-05.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/sessions/orchestrator.ts`, `app/api/src/transport/projections.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Guard both-ready and pipeline start with generation ownership.
2. Project recipient-specific transcript/readiness/shared events.
3. Wire fake analyst callbacks and public safety outcomes without transmitting analyst JSON.

Verification: Inject reordered/duplicate callbacks; assert one pipeline and inspect both socket traces for leakage.
Acceptance IDs: AC-003-04, AC-003-05. Also exercise all related edge cases in spec.md.

Avoid: Do not broadcast internal session objects or assume single-threaded code eliminates async races.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Recover and clean up

Goal: recover and clean up and satisfy FR-003-06, FR-003-07, FR-003-08.
Risk: High.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/sessions/recovery.ts`, `app/api/src/sessions/lifecycle.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Implement snapshot barriers, cached-audio replay, and stale-socket rejection.
2. Implement cancellation and absolute expiry with fake-clock support.
3. Handle failed generation and process-restart session loss explicitly.

Verification: Test reconnect during review/judging, recording interruption, expiry mid-provider call, and late callbacks.
Acceptance IDs: AC-003-06, AC-003-07, AC-003-08. Also exercise all related edge cases in spec.md.

Avoid: Do not restart paid generation on join or extend retention indefinitely via keep-alives.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-003-01 | AC-003-01 | P1 | Not implemented / not run |
| FR-003-02 | AC-003-02 | P1 | Not implemented / not run |
| FR-003-03 | AC-003-03 | P1 | Not implemented / not run |
| FR-003-04 | AC-003-04 | P2 | Not implemented / not run |
| FR-003-05 | AC-003-05 | P2 | Not implemented / not run |
| FR-003-06 | AC-003-06 | P3 | Not implemented / not run |
| FR-003-07 | AC-003-07 | P3 | Not implemented / not run |
| FR-003-08 | AC-003-08 | P3 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

The in-memory design cannot recover after process restart. Exactly-once orchestration is scoped to one live process/session; it does not guarantee provider-side billing exactly once after network uncertainty.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 003-session-gateway-and-recovery. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
