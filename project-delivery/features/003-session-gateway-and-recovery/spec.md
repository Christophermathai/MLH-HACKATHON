# Session gateway, participant isolation, and recovery: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Backend developer.

## Overview

Implement authoritative session state, independent participant progress, one generation run per session, and private recovery after reconnect.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 3, 7, 8, 9; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/003-session-gateway-and-recovery/brainstorm.md) and [sprint](../../brainstorms/003-session-gateway-and-recovery/sprint.md).

## Changes and ownership

Owns side binding, state transitions, event routing, lifecycle, and resume. 005 owns consent UX; 006 owns the analysis pipeline; 007 owns audio manifests and cache contents.

## Explicit working defaults

Use the shared contract's create/claim/join flow, 30-minute absolute session lifetime, and per-side opaque resume token. One active socket per side; successful authenticated reconnect replaces the old socket. Server restart loses in-memory sessions and requires a new room.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-003-01

Create cryptographically random eight-character room codes with collision checks and 32-byte random participant tokens. Bind A at creation and bind B atomically on its first claim; store only token hashes and reject subsequent claims.

### FR-003-02

Track A/B independently through EMPTY, RECORDING, TRANSCRIBING, REVIEW, and READY, with session CREATED, BOTH_READY, MEDIATING, JUDGING, DONE or FAILED. Permit B progress while A is processing; validate every transition.

### FR-003-03

Accept an edited confirmation only with consent:true and valid text; bind consent to immutable confirmed text revision 1. Duplicate identical confirmation is idempotent; a changed post-confirmation submission is rejected.

### FR-003-04

Emit both_ready once both confirmations are accepted, then start mediation once both valid analyst results exist and no safety block applies. Guard one generationId and one pipeline start per session, including concurrent callbacks.

### FR-003-05

Route partial/final transcripts and own review snapshot only to their owner. Keep analyst JSON server-private permanently. Share only readiness, consent-gated mediator/verdict output, and generic terminal safety results.

### FR-003-06

Resume using room, side, and the matching token. Return an authoritative snapshot with that side's text/state and eligible shared output, then replay cached audio as defined by the contract. Reject stale-socket events after replacement.

### FR-003-07

On recording disconnect, cancel that incomplete recording and clear its buffers; completed uploads may finish transcription while disconnected. At absolute expiry cancel all pending jobs, remove transcripts/analysis/audio cache, close sockets, and ignore late callbacks.

### FR-003-08

Enforce per-room resource bounds and public error codes; release completed job references and detached socket references. Keep active participant sockets usable for cached replay until disconnect or expiry. Failed generation does not auto-restart on reconnect; participants can start a new room and retained partial results are marked incomplete.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-003-01 | FR-003-01 | Given simultaneous B claims, exactly one receives B credentials; a caller with only room code and side cannot read or reclaim an occupied side. |
| AC-003-02 | FR-003-02 | Given interleaved A/B recording and review events, neither side's content nor readiness overwrites the other; invalid transitions produce INVALID_STATE. |
| AC-003-03 | FR-003-03 | Given repeated confirmation requests, only the first creates an analyst job; changed text after READY returns CONFIRMATION_LOCKED without changing stored consent. |
| AC-003-04 | FR-003-04 | Given duplicated analyst callbacks and simultaneous confirmations, exactly one mediator/judge pipeline starts; bounded internal validation retries remain allowed. |
| AC-003-05 | FR-003-05 | Given a trace for each socket before and after both consents, neither contains the other side's raw transcript or private analyst notes. |
| AC-003-06 | FR-003-06 | Given A reconnects, it recovers A's acknowledged state and existing verdict without another model run; B's token used for A fails authentication. |
| AC-003-07 | FR-003-07 | Given expiry during synthesis, no late chunk or transcript recreates the room; future join attempts return SESSION_UNAVAILABLE. |
| AC-003-08 | FR-003-08 | Given a failed generation, reconnect returns FAILED with available text and no new provider request; a restarted process clearly reports the old room unavailable. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-003-01 | One consent received or one analyst still pending | Only own-side analysis may run; mediation stays gated. | FR-003-03, FR-003-04, FR-003-05 |
| EC-003-02 | Two sockets race or callbacks arrive after expiry | Replace the old socket on authenticated join; guard all asynchronous commits by room/generation existence. | FR-003-04, FR-003-06, FR-003-07 |
| EC-003-03 | Disconnect during recording versus completed upload | Discard incomplete capture; preserve finalized transcript work for authorized recovery. | FR-003-06, FR-003-07, FR-003-08 |

## Dependencies

- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Persistent accounts, durable restart recovery, distributed locking, cross-region sessions, or resuming an incomplete microphone recording after a disconnect.

## Readiness and execution prerequisites

The in-memory design cannot recover after process restart. Exactly-once orchestration is scoped to one live process/session; it does not guarantee provider-side billing exactly once after network uncertainty.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.
