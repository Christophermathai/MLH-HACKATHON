# Integration, failure recovery, and demo readiness: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Both developers.
Input research: [brainstorm](../../brainstorms/008-integration-and-demo-readiness/brainstorm.md), [brainstorm sprint](../../brainstorms/008-integration-and-demo-readiness/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns end-to-end evidence and rehearsal. Earlier features own fixes to their behavior; this feature does not defer privacy or cleanup implementation until release time.

Use two isolated browser contexts for automated flows and the actual chosen demo devices for manual audio checks. Local loopback is the baseline run environment; any remote microphone demo needs a secure origin and WebSocket-capable single gateway deployment. Record exact browser/runtime/device versions when executed. The six-hour schedule is a target, not evidence of completion.

Dependencies: [001-speech-provider-feasibility](../001-speech-provider-feasibility/status.md), [002-foundation-and-contracts](../002-foundation-and-contracts/status.md), [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/status.md), [004-recording-and-transcription](../004-recording-and-transcription/status.md), [005-transcript-review-and-consent](../005-transcript-review-and-consent/status.md), [006-analysis-mediation-and-safety](../006-analysis-mediation-and-safety/status.md), [007-spoken-verdict-and-playback](../007-spoken-verdict-and-playback/status.md)

Critical path: 001 + 002 + 003 + 004 + 005 + 006 + 007 -> P1 -> P2 -> P3.

Riskiest work: Integrate the deterministic journey; Exercise failures and recovery; Validate live demo and publish evidence. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Integrate the deterministic journey

Goal: integrate the deterministic journey and satisfy FR-008-01, FR-008-02.
Risk: High.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `tests/e2e/`, `tests/fixtures/events/`, `verification.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Wire two isolated browser contexts with deterministic provider fixtures.
2. Cover complete user flow, edited text, consent gating, and participant impersonation cases.
3. Attach reproducible traces to acceptance IDs.

Verification: Run the two-context happy path and private-boundary failures with no live provider dependence.
Acceptance IDs: AC-008-01, AC-008-02. Also exercise all related edge cases in spec.md.

Avoid: Do not share one browser storage context for both participants or hide mocked behavior.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Exercise failures and recovery

Goal: exercise failures and recovery and satisfy FR-008-03, FR-008-04, FR-008-05.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `tests/e2e/failures.spec.ts`, `app/api/tests/integration/`, `verification.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Inject STT, JSON, safety, TTS, and judge failures.
2. Simulate reconnect, duplicate events, late callbacks, and expiry.
3. Inspect provider counters, buffer lifecycle hooks, and sanitized logs.

Verification: Run failure matrix with fake clocks and explicit outcome assertions; repeat only failed checks after fixes.
Acceptance IDs: AC-008-03, AC-008-04, AC-008-05. Also exercise all related edge cases in spec.md.

Avoid: Do not measure cleanup solely by UI messages or accept text-only fallback as a successful voice test.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Validate live demo and publish evidence

Goal: validate live demo and publish evidence and satisfy FR-008-06, FR-008-07, FR-008-08.
Risk: High.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `docs/demo-runbook.md`, `demo/`, `verification.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Record selected runtime/provider/browser configuration and run live samples.
2. Rehearse three minutes and create matching permitted backup media.
3. Publish upstream acceptance results, limitations, and a scope-specific go/no-go decision.

Verification: Manually rehearse on intended devices/network; cross-check evidence against every feature acceptance criterion and label optional deferrals.
Acceptance IDs: AC-008-06, AC-008-07, AC-008-08. Also exercise all related edge cases in spec.md.

Avoid: Do not claim production readiness or publish a live provider pass without recorded observations.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-008-01 | AC-008-01 | P1 | Not implemented / not run |
| FR-008-02 | AC-008-02 | P1 | Not implemented / not run |
| FR-008-03 | AC-008-03 | P2 | Not implemented / not run |
| FR-008-04 | AC-008-04 | P2 | Not implemented / not run |
| FR-008-05 | AC-008-05 | P2 | Not implemented / not run |
| FR-008-06 | AC-008-06 | P3 | Not implemented / not run |
| FR-008-07 | AC-008-07 | P3 | Not implemented / not run |
| FR-008-08 | AC-008-08 | P3 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Provider credentials, human review, demo devices, and any remote host are execution prerequisites. Integration scope may exceed six hours; publish unfinished checks explicitly.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 008-integration-and-demo-readiness. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
