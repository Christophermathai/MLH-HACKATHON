# Analysis, mediation, judge text, and safety: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Backend developer.
Input research: [brainstorm](../../brainstorms/006-analysis-mediation-and-safety/brainstorm.md), [brainstorm sprint](../../brainstorms/006-analysis-mediation-and-safety/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns prompts, schema validation, stage retries, deterministic safety routing, and judge text. 003 owns generation ownership/routing; 007 owns synthesis/playback.

Use an environment-configured structured-JSON-capable LLM behind adapters; specific model access is validated during implementation. Default verdict language is Malayalam, allowing natural familiar English terms for mixed input. petty_score is 0-10, requires_apology is false. Target 400-800 visible Unicode characters; enforce a 1200-character hard cap and 60-second per-stage deadline. A request failure is not retried automatically; invalid structured JSON gets one validation retry.

Dependencies: [002-foundation-and-contracts](../002-foundation-and-contracts/status.md), [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/status.md), [005-transcript-review-and-consent](../005-transcript-review-and-consent/status.md)

Critical path: 002 + 003 + 005 -> P1 -> P2 -> P3.

Riskiest work: Implement isolated analysts and validation; Mediate or take the safety branch; Stream and evaluate judge output. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Implement isolated analysts and validation

Goal: implement isolated analysts and validation and satisfy FR-006-01, FR-006-02, FR-006-03.
Risk: High.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `app/api/src/agents/analyst.ts`, `app/api/src/prompts/`, `app/api/tests/agents/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Build the configured LLM adapter boundary and confirmed-text-only analyst input.
2. Implement schema enforcement, code-fence cleanup, and one invalid-JSON retry.
3. Write uncertainty, side-binding, and injected-instruction fixtures.

Verification: Inspect request capture for side isolation and test malformed JSON, missing flags, wrong side, and retry count.
Acceptance IDs: AC-006-01, AC-006-02, AC-006-03. Also exercise all related edge cases in spec.md.

Avoid: Do not use JSON parse success as schema validation or missing flags as a safe result.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Mediate or take the safety branch

Goal: mediate or take the safety branch and satisfy FR-006-04, FR-006-05.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/agents/pipeline.ts`, `app/api/src/agents/mediator.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Integrate the both-consent/both-analysis gate from 003.
2. Implement generic safety outcome without mediator/judge calls.
3. Validate balanced mediator structure, score, and optional truce.

Verification: Assert zero mediator/judge calls for flagged cases and no shared output with one consent; validate contradictory and forced-apology cases.
Acceptance IDs: AC-006-04, AC-006-05. Also exercise all related edge cases in spec.md.

Avoid: Do not make the safety branch depend on the judge voluntarily following tone instructions.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Stream and evaluate judge output

Goal: stream and evaluate judge output and satisfy FR-006-06, FR-006-07, FR-006-08.
Risk: High.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/agents/judge.ts`, `app/api/src/agents/evaluation/`, `tests/fixtures/conversations/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Stream tagged TTS and display-safe text with bounds and timeout/cancellation.
2. Integrate incomplete-stream failure with 003 and the 002 audio-sink interface using a fake consumer; 007 supplies the real consumer later and 008 verifies the combined flow.
3. Run deterministic fixtures and separately review a real Malayalam example when access exists.

Verification: Test split tags, output cap, timeout after a sentence, cancellation, and fixture reports; manually review balance and language.
Acceptance IDs: AC-006-06, AC-006-07, AC-006-08. Also exercise all related edge cases in spec.md.

Avoid: Do not report prompt-level safety or language quality as proven by mocked tests.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-006-01 | AC-006-01 | P1 | Not implemented / not run |
| FR-006-02 | AC-006-02 | P1 | Not implemented / not run |
| FR-006-03 | AC-006-03 | P1 | Not implemented / not run |
| FR-006-04 | AC-006-04 | P2 | Not implemented / not run |
| FR-006-05 | AC-006-05 | P2 | Not implemented / not run |
| FR-006-06 | AC-006-06 | P3 | Not implemented / not run |
| FR-006-07 | AC-006-07 | P3 | Not implemented / not run |
| FR-006-08 | AC-006-08 | P3 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Prompt adherence and safety detection remain probabilistic. Model access and a Malayalam human reviewer are prerequisites for live quality sign-off; no model has been selected or tested in this documentation task.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 006-analysis-mediation-and-safety. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
