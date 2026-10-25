# Integration, failure recovery, and demo readiness: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Both developers.

## Overview

Verify the integrated two-participant journey, document observed failure behavior, and prepare a repeatable three-minute demonstration with an accurately labeled backup.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 8, 9, 10, 11; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/008-integration-and-demo-readiness/brainstorm.md) and [sprint](../../brainstorms/008-integration-and-demo-readiness/sprint.md).

## Changes and ownership

Owns end-to-end evidence and rehearsal. Earlier features own fixes to their behavior; this feature does not defer privacy or cleanup implementation until release time.

## Explicit working defaults

Use two isolated browser contexts for automated flows and the actual chosen demo devices for manual audio checks. Local loopback is the baseline run environment; any remote microphone demo needs a secure origin and WebSocket-capable single gateway deployment. Record exact browser/runtime/device versions when executed. The six-hour schedule is a target, not evidence of completion.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-008-01

Create a repeatable two-context end-to-end scenario covering create/claim, independent speech input, transcript edits, two explicit consents, mediator result, streamed audio, and replay.

### FR-008-02

Exercise participant isolation and consent bypass attempts, including occupied-side reclaim, wrong resume token, single-consent output, and edited confirmed text.

### FR-008-03

Exercise STT failure with batch/typed recovery, malformed JSON retry exhaustion, safety flags, TTS primary/fallback exhaustion, and judge interruption. Verify the exact outcome and user recovery path for each.

### FR-008-04

Exercise reconnect during review and judging, simultaneous participants, duplicate events, and late callbacks. Verify cache replay never adds paid generation and that unsaved text is not claimed as restored.

### FR-008-05

Verify microphone shutdown, app-owned raw-audio deletion, session expiry, cache disposal, and late-event rejection using observable hooks or fake clocks. Inspect output/logs for credentials and private transcript leakage.

### FR-008-06

Run real Malayalam/code-switched speech and TTS on the actual demo environment, recording model/config/device details and latency observations. Keep mock results separate; missing access or human review blocks live voice sign-off.

### FR-008-07

Prepare a three-minute runbook with participant roles, start/reset instructions, privacy notice, noisy-room text controls, and a matching prerecorded backup labeled as prerecorded. Use synthetic or explicitly permitted demo material.

### FR-008-08

Publish verification.md with each upstream acceptance criterion's observed result/evidence, deferred optional streaming, known limitations, and a go/no-go decision for the demonstrated scope. No feature becomes verified solely by completing documentation.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-008-01 | FR-008-01 | Given the scenario on the integrated app, both contexts reach the expected result using their edited text, with a passing event trace and no duplicate provider generation. |
| AC-008-02 | FR-008-02 | Given malicious or malformed client actions, they fail without exposing private text/analysis or starting unauthorized mediation. |
| AC-008-03 | FR-008-03 | Given injected failures, the report distinguishes text-only success, calm safety completion, and failed/incomplete generation rather than treating them all as success. |
| AC-008-04 | FR-008-04 | Given reconnect/race scenarios, authoritative state and provider call counters match the contract without cross-side data leakage. |
| AC-008-05 | FR-008-05 | Given success, cancellation, failure, and expiry, the evidence identifies cleanup at each lifecycle boundary and no sensitive production log payload. |
| AC-008-06 | FR-008-06 | Given live evidence, the report identifies exactly which providers and devices worked; an all-mock run cannot certify a live voice demo. |
| AC-008-07 | FR-008-07 | Given a failed network during rehearsal, the presenters can switch to the labeled matching backup without suggesting it is a newly generated live verdict. |
| AC-008-08 | FR-008-08 | Given the report, a reviewer can distinguish passed, failed, blocked, deferred, and not-run checks and reproduce the documented demo commands. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-008-01 | Remote venue blocks provider/network access | Record live check blocked; use the clearly labeled prerecorded backup or describe a typed/text-only demonstration accurately. | FR-008-03, FR-008-06, FR-008-07, FR-008-08 |
| EC-008-02 | One device refuses autoplay or microphone access | Exercise Play activation and typed entry; do not certify voice capture on that device without a successful check. | FR-008-01, FR-008-03, FR-008-06 |
| EC-008-03 | Process restart during demo | Show session unavailable and start a new room; never imply durable recovery. | FR-008-04, FR-008-07, FR-008-08 |

## Dependencies

- [001-speech-provider-feasibility](../001-speech-provider-feasibility/spec.md)
- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)
- [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/spec.md)
- [004-recording-and-transcription](../004-recording-and-transcription/spec.md)
- [005-transcript-review-and-consent](../005-transcript-review-and-consent/spec.md)
- [006-analysis-mediation-and-safety](../006-analysis-mediation-and-safety/spec.md)
- [007-spoken-verdict-and-playback](../007-spoken-verdict-and-playback/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Publishing/deploying to external services during this documentation task, production-scale claims, broad load testing, analytics, or recording real disagreements without consent.

## Readiness and execution prerequisites

Provider credentials, human review, demo devices, and any remote host are execution prerequisites. Integration scope may exceed six hours; publish unfinished checks explicitly.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.
