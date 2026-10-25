# Application foundation and shared contracts: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Frontend developer with backend contract review.

## Overview

Create a runnable Next.js frontend and Node TypeScript gateway with shared runtime-validated contracts and fake providers that let the team build independently.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 1, 2, 3, 5, 7; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/002-foundation-and-contracts/brainstorm.md) and [sprint](../../brainstorms/002-foundation-and-contracts/sprint.md).

## Changes and ownership

Owns the wire/schema definitions and local scaffold. Feature 003 implements session semantics; 004-007 implement consumers. Protocol additions below supplement architecture section 7 explicitly.

## Explicit working defaults

Use npm workspaces, strict TypeScript, Next.js/Tailwind in app/frontend, Node WebSocket gateway in app/api, and runtime schemas in packages/contracts. Use a single gateway process with an in-memory store. Local ports: frontend 3000 and gateway 8787. Pin compatible versions at scaffold time rather than embedding unverified versions here.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-002-01

Create frontend, gateway, and shared-contract workspaces with documented install/start commands, placeholder environment variables, and explicit mock/live modes. Mock mode must start without external credentials.

### FR-002-02

Define one versioned JSON envelope and validated payload schema for every architecture event plus the specified extensions. Reject unknown event types, invalid payloads, wrong direction, and illegal binary framing with sanitized errors.

### FR-002-03

Define the bootstrap/participant contract and authenticated join/resume snapshot described below. Never put resume secrets in shareable URLs or log them.

### FR-002-04

Define separate private analyst, public mediator, and safety result schemas, preserving architecture fields. petty_score is an integer 0-10; requires_apology must be false; private analyst notes are excluded from public events.

### FR-002-05

Define stable STT stream/batch, structured LLM, judge stream, and sentence-TTS interfaces with cancellation, bounded timeouts, normalized errors, and deterministic fake implementations.

### FR-002-06

Define input recording formats, frame/session limits, output audio framing, seq ordering, and completion/replay contracts in the appendix. Model audio failures as resolved gaps so playback never waits forever.

### FR-002-07

Establish lint, typecheck, unit-test, build, and targeted end-to-end script names in actual package manifests. Keep provider SDK/configuration server-side and validate configured browser origins.

### FR-002-08

Publish local setup and an event-contract guide, including proposed extensions, privacy projections, mock/live limitations, and baseline fixtures consumed by later features.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-002-01 | FR-002-01 | Given a clean checkout and dependencies installed, the documented local commands start the frontend and gateway in mock mode; required missing live configuration produces a clear startup error. |
| AC-002-02 | FR-002-02 | Given malformed or direction-swapped fixtures, validation fails deterministically; valid architecture and extension fixtures parse with one schema definition. |
| AC-002-03 | FR-002-03 | Given the contracts, room creation, first B claim, repeated claims, credential failure, and successful resume all have explicit request/response fixtures. |
| AC-002-04 | FR-002-04 | Given invalid scores, missing safety_flags, or requires_apology:true, schema validation fails; no public snapshot type contains analyst JSON. |
| AC-002-05 | FR-002-05 | Given fake adapters, consumers can exercise partial transcript, malformed JSON, reordered TTS completion, provider failure, and cancellation without SDK-specific types. |
| AC-002-06 | FR-002-06 | Given fixtures for success, one failed sentence, and all-audio failure, the contract yields an unambiguous final manifest and completion state. |
| AC-002-07 | FR-002-07 | Given a scaffold smoke check, shared types build, mock fixtures validate, and the frontend bundle contains no provider credentials or server modules. |
| AC-002-08 | FR-002-08 | Given a new developer, the guide explains the record-review-verdict flow, service ports, where schemas live, and which behaviors are still pending implementation. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-002-01 | Malformed JSON, binary outside recording, oversized payload | Reject with a bounded public error; never include raw payload or SDK detail. | FR-002-02, FR-002-06 |
| EC-002-02 | Claimed side or room known but resume token missing | Room/side knowledge never grants access to the existing side. | FR-002-03 |
| EC-002-03 | Optional streaming input is disabled | Batch input and typed confirmation remain valid; mock traces label the mode. | FR-002-05, FR-002-06, FR-002-08 |

## Dependencies

None. This feature can start alongside the other foundation work.

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Real provider integration, complete product screens, databases, Redis/queues, multi-instance hosting, account login, or deployment to an external service.

## Readiness and execution prerequisites

This plan adds explicit protocol details absent from the architecture. Keep the shared schema package authoritative. Runtime/dependency compatibility will be verified when scaffolding is implemented.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.

## Protocol and data appendix

This appendix defines the proposed v1 contract shared by all eight feature specs. Architecture section 7 supplies the baseline names; additions and payload extensions here are explicit design decisions.

### Envelope and bootstrap

JSON messages use `{v:1,type,payload,requestId?}`. Client control messages carry a UUID requestId; responses may echo it. Binary input frames are not JSON. A side has one active recording and one active socket, so ordered binary frames belong to the recording established by start_recording. No secrets, raw payloads, or provider errors enter production logs.

| Operation | Request | Result |
| --- | --- | --- |
| POST /api/rooms | Empty JSON object | 201: room, side:A, resumeToken, expiresAt |
| POST /api/rooms/{room}/participants | side:B | 201 on first claim: room, side:B, resumeToken, expiresAt; 409 when occupied |
| WebSocket /ws join | room, side, resumeToken | session_snapshot on success; sanitized error and close on invalid credentials |
| Reconnect | Same authenticated join | Replace old socket, authoritative snapshot, cached clips, then live events |

The creator shares only the room code, never their token. Store the resume token in per-tab sessionStorage; losing it requires a new room. Tokens are 32 random bytes encoded safely, hashed server-side, and bound to one side. An eight-character random room code is an invitation for the first B claim, not proof of ownership of an occupied side. Rate-limit creation to 10/minute and B claims to 20/minute per source address; cap active rooms at 100 with a clear capacity error. Deploy behind a correctly configured trusted proxy if source addresses are forwarded. Single-process state cannot survive restart.

### Client events

| Event | Payload and behavior |
| --- | --- |
| join (extended) | room, side, resumeToken; required before other events |
| start_recording (added) | mode:batch or streaming; mime; streaming also declares sampleRate:16000, channels:1, format:pcm_s16le; accepted only for unconfirmed side |
| audio_chunk (baseline binary) | At most 32 KiB/frame, cumulative 5 MiB/60 seconds; format established by start_recording |
| stop_recording | {}; repeated stop does not repeat provider finalization |
| cancel_recording (added) | {}; abort capture/provider and clear raw data; idempotent before confirmation |
| start_typed_input (added) | {}; abandon any incomplete recording and enter REVIEW with empty editable text |
| confirm_transcript | text, consent:true; trimmed length 1-4000 Unicode code points; immutable once accepted |
| replay_audio (added) | {}; available after output resolves; resend cached clips/statuses only |

Batch input is an encoded complete recording assembled from frames. Only configured MIME types validated in 001 are accepted. Streaming uses 16 kHz mono signed 16-bit little-endian PCM, resampling before transmission. MIME negotiation never claims encoded bytes are PCM. Control JSON is limited to 64 KiB, separately from the smaller audio-frame limit.

### Server events

| Event | Payload and visibility |
| --- | --- |
| session_snapshot (added) | room, side, expiresAt, ownState, ownText, ownConfirmed, ownConsent, readiness:{A,B}, sessionState, generationId; consent-gated sharedResult/verdictText/outcome/audioManifest when present |
| recording_started (added) | accepted mode and mime, to recording owner |
| partial_transcript | text; owner only |
| final_transcript | text, optional unclear_lines; owner only |
| side_ready | side; confirms accepted text/consent, not analyst completion |
| both_ready | {}; both confirmations accepted; analysis may still be finishing |
| analysis_json | Validated mediator object only, after both consents |
| verdict_text_delta | text; display-safe text without emotion tags |
| safety_result (added) | message; generic, shared only after both consents, never flagged side or analyst notes |
| audio_chunk | seq, mime, data; data is base64 for one complete independently decodable sentence clip |
| audio_status (added) | seq, status:ready or failed; failed includes a public code |
| audio_manifest (added) | totalSentences, textComplete, entries:[{seq,status:ready or failed}]; final only after jobs settle |
| done (extended) | outcome:verdict, safety, or incomplete; server output resolved, not playback finished |
| error | code, message, optional fallback; no raw provider detail or private content |

generationId identifies the one run per room; it is carried in snapshot and all shared generation/audio event payloads. seq starts at zero within that generation. Binary output is not overloaded with binary input framing: output clips use the JSON audio_chunk schema. Aggregate provider fragments before declaring a clip playable. Cap each decoded clip at 2 MiB and total cached decoded audio at 20 MiB/session; exceeding either marks affected audio failed while preserving text. At most two sentence jobs run concurrently, including fallback work.

On join, serialize snapshot creation and outbound queuing so the new socket receives a complete text snapshot first, cached clips/statuses next, and any newer text deltas afterward. The client replaces its local text with the snapshot, does not append it, and deduplicates audio by generationId+seq. No raw analyst JSON or other participant transcript is present even after both consent. If the own transcript is unconfirmed, only the last server-finalized text is recoverable; unsaved edits are not persisted.

A successful text run with no usable audio still resolves outcome:verdict with failed audio entries. A safety run has generic safety_result, zero audio entries, and outcome:safety. A failed judge stream has outcome:incomplete, textComplete:false, a FAILED session state, and no automatic regeneration. Pre-judge terminal failures also resolve incomplete with zero audio if none was dispatched. This distinction prevents done from implying a successful verdict.

A clip marked ready by the server can still fail decoding on one browser. That browser records a local playback failure, shows an audio notice, and may advance past the clip; it must not rewrite the shared manifest or report a synthesis failure for other participants. On explicit replay, it may retry decoding cached bytes without another provider call.

### Model schemas

Analyst object: side:A or B; upset_about, stated_facts, assumptions_made, possible_feelings, unclear_lines as string arrays; safety_flags:{abuse_or_coercion_signals:boolean,notes:string}. Require every field, reject unknown properties and wrong side, bound each array to 20 entries, each string to 1000 Unicode code points, and notes to 1000. The server's side binding is authoritative.

Mediator object: what_each_is_upset_about:{A:string[],B:string[]}; where_interpretations_differ:string[]; petty_score:integer from 0 to 10; zoom_out:{immediate_issue:string,possible_underlying_feelings:string[],bigger_picture:string}; truce:{next_step:string,requires_apology:false}. Require all fields and reject unknown properties. Bound arrays to 20 entries and strings to 1000 Unicode code points. Structured model responses are limited to 64 KiB before parsing. Structured JSON gets one validation retry after optional enclosing-fence removal.

Judge output is plain streamed text with supported emotion tags kept on the internal TTS path and stripped from display. Limit visible text to 1200 Unicode code points, preserving a final complete sentence when the limit can be enforced cleanly; a hard truncation is an incomplete outcome rather than an invented ending.

### Lifecycle and public errors

Session expiry is an absolute 30 minutes from creation, never refreshed by activity. Check it before accepting events and committing provider callbacks; remove expired state with a timer (within one second when the process is running). Each side's confirmed revision is locked at 1; retry identical confirmations as no-ops, reject changes, and offer a new room.

Errors include BAD_EVENT, INVALID_STATE, BAD_AUDIO, LIMIT_EXCEEDED, SIDE_TAKEN, UNAUTHORIZED, SESSION_UNAVAILABLE, CONFIRMATION_LOCKED, STT_FAILED, MODEL_INVALID, MODEL_FAILED, TTS_FAILED, and CAPACITY. error does not itself mark every recoverable issue terminal; feature specs specify whether to return to review/type or end FAILED. Unknown/expired rooms share SESSION_UNAVAILABLE. Validate the browser Origin allowlist during HTTP/WebSocket access. Live remote microphone capture uses a secure origin and encrypted WebSocket transport.
