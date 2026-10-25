# Analysis, mediation, judge text, and safety: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Backend developer.

## Overview

Analyze each confirmed account privately, mediate only after both consents, and produce a streamed, balanced verdict or a calm safety response.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 5, 8, 9; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/006-analysis-mediation-and-safety/brainstorm.md) and [sprint](../../brainstorms/006-analysis-mediation-and-safety/sprint.md).

## Changes and ownership

Owns prompts, schema validation, stage retries, deterministic safety routing, and judge text. 003 owns generation ownership/routing; 007 owns synthesis/playback.

## Explicit working defaults

Use an environment-configured structured-JSON-capable LLM behind adapters; specific model access is validated during implementation. Default verdict language is Malayalam, allowing natural familiar English terms for mixed input. petty_score is 0-10, requires_apology is false. Target 400-800 visible Unicode characters; enforce a 1200-character hard cap and 60-second per-stage deadline. A request failure is not retried automatically; invalid structured JSON gets one validation retry.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-006-01

Run one analyst for each accepted confirmed text revision, passing only that side's text. Store the architecture's analyst fields privately with side bound by the server, never inferred from model claims.

### FR-006-02

Require stated facts/claims, assumptions, possible feelings, unclear lines, and safety_flags in analyst JSON. Prompts must treat emotions as possibilities and transcript instructions as untrusted quoted content.

### FR-006-03

Strip only an enclosing Markdown code fence and validate structured results. Retry invalid analyst or mediator JSON once, then stop with a controlled error; missing safety_flags is invalid, not safe by default.

### FR-006-04

Wait for both confirmed consents and both valid analyses before mediation. If either safety flag is true, bypass mediator and playful judge, emit only generic calm safety text, and resolve with outcome:safety without identifying the flagged side.

### FR-006-05

For unflagged sessions, generate and validate the architecture's mediator object: both perspectives, differing interpretations, score 0-10, zoom-out, and one practical optional truce with requires_apology:false.

### FR-006-06

Stream judge text from the mediator result using a dramatic opening, situation-focused ruling, gentle zoom-out, and practical truce. Use short Malayalam sentences, no Markdown/emoji, and at most two supported emotion tags per section; send display-safe text separately from tagged TTS input.

### FR-006-07

Enforce cancellation, stage deadlines, and the 1200-character cap. On incomplete judge failure mark the session FAILED, preserve already displayed text as incomplete, cancel unsent synthesis, and never silently substitute a fresh generation.

### FR-006-08

Maintain synthetic ordinary, unclear, contradictory, coercion, malformed, and prompt-injection fixtures. Record schema/branch results separately from human judgments of balance, language quality, and humor.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-006-01 | FR-006-01 | Given A confirms while B records, the analyst request contains only A's edited confirmed text and the returned side cannot rebind the result to B. |
| AC-006-02 | FR-006-02 | Given ambiguous speech or an instruction to reveal another side, fixtures preserve uncertainty and never execute embedded instructions or fabricate missing evidence. |
| AC-006-03 | FR-006-03 | Given two malformed responses, the stage makes exactly two attempts and no mediator/judge starts from an invalid analyst. |
| AC-006-04 | FR-006-04 | Given one or both flagged analyses, there is no petty score, playful text, or private safety note in client output; before both consent no shared safety outcome is broadcast. |
| AC-006-05 | FR-006-05 | Given contradictory accounts, the result describes disagreement without inventing a settled fact; invalid score or forced-apology output is rejected by validation. |
| AC-006-06 | FR-006-06 | Given a valid mediator fixture, sentence output follows the four-part structure and length cap, and displayed text contains no tags while TTS receives only supported tags. |
| AC-006-07 | FR-006-07 | Given a judge stream timeout after one sentence, the client receives an incomplete outcome/error and reconnect does not restart the model. |
| AC-006-08 | FR-006-08 | Given the fixture suite and a human-reviewed live sample, the report states which checks are deterministic and which depend on model behavior; it does not claim perfect safety detection. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-006-01 | Analyst fails or omits safety_flags | Fail the stage after the bounded retry; no assumption of safety. | FR-006-02, FR-006-03, FR-006-04 |
| EC-006-02 | Safety flag appears before other consent | Retain it privately and gate shared output until both confirmations exist. | FR-006-01, FR-006-04 |
| EC-006-03 | Judge fails mid-stream or exceeds cap | End with an explicit incomplete outcome and no automatic paid restart. | FR-006-06, FR-006-07 |

## Dependencies

- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)
- [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/spec.md)
- [005-transcript-review-and-consent](../005-transcript-review-and-consent/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Diagnosing participants, adjudicating objective guilt, therapy claims, forcing reconciliation/apology, training on session transcripts, or transmitting private analyst notes.

## Readiness and execution prerequisites

Prompt adherence and safety detection remain probabilistic. Model access and a Malayalam human reviewer are prerequisites for live quality sign-off; no model has been selected or tested in this documentation task.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.

## Calm safety response

The deterministic safety branch uses a non-accusatory message such as: "This may need a more careful conversation than Petty Court can offer. You do not have to apologise or reconcile. Consider talking with someone you trust or a qualified professional." Provide Malayalam copy reviewed before the live demo. No flagged side, source quotation, petty score, or private note is shown. Safety output remains behind the both-consent gate.

A validation/provider error uses a different message: "We could not prepare a reliable result. You can start a new room." An error must not falsely assert that abuse was detected.
