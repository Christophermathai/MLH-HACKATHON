# Recording and transcription: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Frontend developer for capture; backend developer for STT.

## Overview

Capture bounded participant speech, obtain a private editable transcript, and recover through batch or typed input when streaming or recognition fails.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 2, 4, 7, 9; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/004-recording-and-transcription/brainstorm.md) and [sprint](../../brainstorms/004-recording-and-transcription/sprint.md).

## Changes and ownership

Owns microphone lifecycle, input encoding, STT adapters, and raw-audio cleanup. 005 owns text editing and confirmation; 003 owns recipient binding and state.

## Explicit working defaults

Batch capture is the required MVP path; PCM streaming is an explicit extension phase. Limit recordings to 60 seconds and 5 MiB total with 32 KiB frames. Encoded batch MIME must match a configuration validated in 001; unsupported browser/provider combinations go to typed input. Use 60-second batch and 15-second streaming-inactivity deadlines.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-004-01

Provide start/stop capture on the record screen with elapsed time, recording/processing status, and visible typed-input alternative. Request microphone access only after an explicit user action.

### FR-004-02

Negotiate and declare a supported recording mode/MIME before audio frames. Enforce 60 seconds, 5 MiB total, and 32 KiB/frame in browser and gateway; never label encoded MediaRecorder bytes as PCM.

### FR-004-03

Implement one STT batch adapter behind the shared interface using the selected provider's verified encoding. On a complete recording produce exactly one final_transcript for its owner and enter REVIEW.

### FR-004-04

For the streaming extension, resample to 16 kHz mono signed 16-bit little-endian PCM and send 100-250 ms chunks; show private partial text and replace it with the final transcript on stop.

### FR-004-05

For a streaming failure, retain only the bounded current recording and invoke batch once after stop; keep capturing bounded chunks until stop when transport is healthy. Never finalize both streaming and batch results.

### FR-004-06

Expose unclear text when returned by the provider and allow users to correct all text in 005. Empty/silent or failed recognition offers typed input; do not manufacture missing speech or silently mark recognition as confirmed.

### FR-004-07

Stop microphone tracks on stop/cancel/navigation/disconnect. Delete client and server raw buffers/files after transcription or terminal failure, and on capture cancellation/expiry; cancel provider work on expiry and discard late results.

### FR-004-08

Normalize provider failure/timeouts to public STT errors and maintain a retry path before confirmation. Retrying starts a fresh recording identity; old callbacks cannot overwrite the new transcript.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-004-01 | FR-004-01 | Given microphone denial or unavailability, the participant can open typed review immediately without repeated permission prompts. |
| AC-004-02 | FR-004-02 | Given an oversized frame, unsupported MIME, or duration limit, the gateway stops/rejects the capture with a clear error and releases buffers; the browser can retry or type. |
| AC-004-03 | FR-004-03 | Given a successful batch recording, the owner receives final text once while the other side receives no transcript; no analyst runs until confirmation. |
| AC-004-04 | FR-004-04 | Given a non-16-kHz source and a stream-enabled build, sent samples have the declared rate/format and the finalized transcript replaces rather than duplicates partial text. A batch-only build records this criterion as deferred. |
| AC-004-05 | FR-004-05 | Given streaming fails mid-recording, one batch attempt receives the complete retained recording and exactly one final transcript is committed. |
| AC-004-06 | FR-004-06 | Given silence or low-quality recognition, the UI shows an actionable error or editable result without claiming correctness or granting consent. |
| AC-004-07 | FR-004-07 | Given success, terminal STT error, cancellation, or expiry, no retained raw recording remains in app-owned storage and no active microphone track survives. |
| AC-004-08 | FR-004-08 | Given a timed-out request followed by a new recording, a late response from the first attempt is ignored and the second result alone reaches REVIEW. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-004-01 | Permission denied or unsupported encoded MIME | Offer typed review immediately; do not request silent transcoding from an unsupported provider. | FR-004-01, FR-004-02, FR-004-06 |
| EC-004-02 | Stream fails after partial results | Discard partial text as authoritative input and commit the single batch final result. | FR-004-04, FR-004-05 |
| EC-004-03 | Stop, cancel, expiry, and provider completion race | The active recording identity and state decide which result can commit; every path clears raw data. | FR-004-07, FR-004-08 |

## Dependencies

- [001-speech-provider-feasibility](../001-speech-provider-feasibility/spec.md)
- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)
- [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Diarization, indefinite recording, permanent audio storage, editing recorded audio, or claiming live partial transcripts on a batch-only build.

## Readiness and execution prerequisites

Browser/provider codec compatibility requires unit 001 evidence and a real-device check. Optional streaming is separately tracked so batch MVP completion does not imply streaming completion.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.
