# Transcript review and consent: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Frontend developer; backend developer enforces confirmation.
Input research: [brainstorm](../../brainstorms/005-transcript-review-and-consent/brainstorm.md), [brainstorm sprint](../../brainstorms/005-transcript-review-and-consent/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns the review screen and consent interaction. Gateway confirmation/state enforcement remains in 003; 004 supplies optional real speech transcripts.

Trim leading/trailing whitespace, preserve internal Unicode content, and accept 1-4000 Unicode code points. Consent starts unchecked. Confirmation locks text for that session; a changed account requires a new room. Room codes alone do not recover content. Use Malayalam-capable text fields and keyboard controls.

Dependencies: [002-foundation-and-contracts](../002-foundation-and-contracts/status.md), [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/status.md)

Critical path: 002 + 003 -> P1 -> P2 -> P3.

Riskiest work: Connect authoritative confirmation. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Build private review UI

Goal: build private review ui and satisfy FR-005-01, FR-005-02, FR-005-03.
Risk: Medium.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `app/frontend/src/features/review/`, `tests/fixtures/consent/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Build editable text, uncertainty hints, typed mode, and keyboard labels.
2. Add exact notice/consent text and an initially unchecked checkbox.
3. Drive states from mock own-side snapshots.

Verification: Component checks cover Malayalam edits, hints, typed entry, initial consent state, and accessible controls.
Acceptance IDs: AC-005-01, AC-005-02, AC-005-03. Also exercise all related edge cases in spec.md.

Avoid: Do not put both transcripts in one shared client store or preselect consent.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Connect authoritative confirmation

Goal: connect authoritative confirmation and satisfy FR-005-04, FR-005-05, FR-005-06.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/frontend/src/features/review/`, `app/frontend/src/realtime/`, `app/api/tests/sessions/confirmation.test.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Share Unicode validation and submit edited text with a request identity.
2. Wait for acknowledgement and reconcile duplicate/reconnect outcomes.
3. Lock acknowledged input and show permitted readiness progress.

Verification: Test edited text propagation, whitespace/length bounds, missing consent, lost ack, duplicate submit, and single-consent waiting.
Acceptance IDs: AC-005-04, AC-005-05, AC-005-06. Also exercise all related edge cases in spec.md.

Avoid: Do not infer READY from a local button click or run analysis on original STT text.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Handle exit and recovery states

Goal: handle exit and recovery states and satisfy FR-005-07, FR-005-08.
Risk: Medium.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/frontend/src/features/review/`, `tests/e2e/review.spec.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Add pre-confirmation retry/leave and post-confirmation new-room action.
2. Handle expiry, rejected edits, and authoritative reload state.
3. Check screen-reader status messages and keyboard navigation.

Verification: Exercise late transcript arrival, locked edit rejection, reconnect with unsaved changes, and expiry.
Acceptance IDs: AC-005-07, AC-005-08. Also exercise all related edge cases in spec.md.

Avoid: Do not claim that leaving the page revokes an already accepted confirmation.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-005-01 | AC-005-01 | P1 | Not implemented / not run |
| FR-005-02 | AC-005-02 | P1 | Not implemented / not run |
| FR-005-03 | AC-005-03 | P1 | Not implemented / not run |
| FR-005-04 | AC-005-04 | P2 | Not implemented / not run |
| FR-005-05 | AC-005-05 | P2 | Not implemented / not run |
| FR-005-06 | AC-005-06 | P2 | Not implemented / not run |
| FR-005-07 | AC-005-07 | P3 | Not implemented / not run |
| FR-005-08 | AC-005-08 | P3 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Confirmation locking and 4000-character limits are explicit working defaults. Unsaved edits survive normal component state only; they are not promised to survive reload.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 005-transcript-review-and-consent. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
