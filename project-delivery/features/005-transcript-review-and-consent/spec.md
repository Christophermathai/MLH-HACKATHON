# Transcript review and consent: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Frontend developer; backend developer enforces confirmation.

## Overview

Let participants edit their own transcript or enter text, explicitly consent, and wait safely for a shared verdict.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 3, 4, 7, 8; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/005-transcript-review-and-consent/brainstorm.md) and [sprint](../../brainstorms/005-transcript-review-and-consent/sprint.md).

## Changes and ownership

Owns the review screen and consent interaction. Gateway confirmation/state enforcement remains in 003; 004 supplies optional real speech transcripts.

## Explicit working defaults

Trim leading/trailing whitespace, preserve internal Unicode content, and accept 1-4000 Unicode code points. Consent starts unchecked. Confirmation locks text for that session; a changed account requires a new room. Room codes alone do not recover content. Use Malayalam-capable text fields and keyboard controls.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-005-01

Display the participant's final transcript in an editable multiline field, with unclear-line hints when available. Preserve Malayalam/English text and never render the other side's transcript.

### FR-005-02

Allow typed entry through the same review screen and confirmation event, including when microphone access fails. Typed mode moves an eligible unconfirmed side into REVIEW without requiring a fake audio recording.

### FR-005-03

Require an unchecked consent checkbox plus a deliberate Confirm and share action. Display the notice and consent copy below, and communicate that text locks on confirmation.

### FR-005-04

Validate text length and consent in both client and gateway; submit the exact trimmed edited text with consent:true, not the original recognition result.

### FR-005-05

Keep review pending until side_ready acknowledges acceptance. Disable repeated clicks while pending, and handle duplicate identical requests idempotently after network uncertainty.

### FR-005-06

Lock editing after acknowledgement and show own readiness plus generic waiting/processing progress. Never reveal which private content or flag belongs to the other participant.

### FR-005-07

Before confirmation allow edit/retry/type and leaving without consent. After confirmation explain that new text needs a new room; a rejected change preserves the confirmed text and offers a new-session action.

### FR-005-08

Make error, reconnect, and expiry states accessible: labelled fields, keyboard-operable controls, announced status changes, and visible instructions to reconnect or start a new room. Restore only server-acknowledged text/state after reload.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-005-01 | FR-005-01 | Given STT text with errors, the participant can edit it and see hints without access to the other participant's text. |
| AC-005-02 | FR-005-02 | Given typed input from EMPTY or an abandoned capture, confirmation can succeed using the same validation and consent path as recognized speech. |
| AC-005-03 | FR-005-03 | Given a newly opened review screen, consent is false; the participant understands provider processing, derived-result sharing, and the lock before submitting. |
| AC-005-04 | FR-005-04 | Given an edit, whitespace-only input, oversized Unicode text, or missing consent, only valid edited text is accepted and sent to the analyst. |
| AC-005-05 | FR-005-05 | Given a lost acknowledgement and retry/reconnect, the UI converges on the accepted READY state without duplicate analyst jobs or implied consent. |
| AC-005-06 | FR-005-06 | Given only A confirmed, A sees a waiting state and B sees only permitted readiness; no mediator/verdict output is shown yet. |
| AC-005-07 | FR-005-07 | Given an attempted post-confirmation edit through a crafted request, the server rejects it and the UI retains acknowledged text. |
| AC-005-08 | FR-005-08 | Given reconnect before acknowledgement or after expiry, the screen never silently checks consent or pretends unsaved edits were stored. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-005-01 | Unicode length versus byte length | Validate 1-4000 Unicode code points in both layers; transport byte limits remain separate. | FR-005-01, FR-005-04 |
| EC-005-02 | Lost confirmation acknowledgement | Recover authoritative READY or REVIEW state, then retry only if needed. | FR-005-05, FR-005-08 |
| EC-005-03 | Late partial/final transcript after user editing | Do not overwrite edited text or a locked confirmation; obsolete recording events are ignored. | FR-005-01, FR-005-04, FR-005-07 |

## Dependencies

- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)
- [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Shared transcript editing, automatically checked consent, editing after confirmation, retroactively retracting a verdict already generated, or exposing private analyses.

## Readiness and execution prerequisites

Confirmation locking and 4000-character limits are explicit working defaults. Unsaved edits survive normal component state only; they are not promised to survive reload.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.

## Participant copy and confirmation semantics

Show: "ZoomOut is for everyday disagreements, not for situations involving abuse or safety concerns."

Before recording, explain: "Your recording is sent to a speech provider to make a transcript. ZoomOut removes its copy of the audio after transcription. You can review and edit the text before sharing."

Consent checkbox: "I confirm this text represents my side. I agree to AI processing of this text and sharing the combined perspective and verdict after both people consent."

Explain before submission: "Your text locks when you confirm. Start a new room if you need to change it. ZoomOut keeps session text and results until this room expires, up to 30 minutes from creation."

Provider-side retention is not promised by these statements; provider account policies must be checked during live setup. The UI must not claim deleting local buffers deletes third-party copies.
