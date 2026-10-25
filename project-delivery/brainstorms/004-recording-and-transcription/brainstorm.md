# Recording and transcription

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: L. Main risk: High.
Suggested owner: Frontend developer: capture; backend developer: STT adapter.

## Problem and research

Convert each participant's speech into editable text while containing microphone, encoding, language-quality, and provider failures.

The architecture expects 16 kHz mono PCM in roughly 100-250 ms chunks, plus partial and final transcript events. Browser capture rates must be converted when necessary. MediaRecorder fallback produces encoded media and cannot be passed as raw PCM without a documented compatible path.

Sources: [architecture](../../../zoomout_architecture.md), Sections 2, 4, 7, and 9; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Implement microphone permission, capture, stop, and resource cleanup on the record screen.
- Send correctly encoded chunks and render private partial transcripts.
- Implement STT streaming and bounded recording retention for batch retry.
- Deliver a final editable transcript or a clear typed-input fallback; clean raw audio on completion and terminal failure.

Excluded: No diarization, audio editing studio, unlimited recordings, or permanent audio archive.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| Streaming PCM with batch fallback | Build AudioWorklet capture and streaming STT first. | Delivers the live transcript experience. | Encoding, resampling, and stream recovery take more time. | High | L |
| Batch input first, streaming later (recommended for the six-hour target) | Capture a bounded recording and process through the adapter's batch method. | Earlier usable voice flow and simpler initial integration. | Partial transcripts arrive only when streaming is later added. | Medium | M |

## Recommended approach

Recommend a batch-first implementation for the time-boxed MVP, with explicit encoding and the same final_transcript contract. Add streaming input once the full spoken-verdict journey works and 001 confirms streaming access.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 001 provider formats, 002 contracts, 003 session API. Mock development can start after 002.

Deliver to the next unit: One final transcript per side, optional partial events, sanitized errors, and recording cleanup guarantees. Unit 005 owns editing and consent; unit 003 owns state transitions.

Likely files/systems: Proposed: app/frontend/src/features/recording/, app/frontend/public/worklets/, app/api/src/providers/stt/, app/api/tests/stt/.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- Permission denial offers typed entry without trapping the participant.
- Supported recordings produce a final transcript with the correct side binding.
- Streaming failure can retry the retained recording in batch without duplicate finalization.
- Raw buffers/files and microphone tracks are released after completion, cancellation, or terminal failure.

## Open decisions

- Maximum recording length and frame size?
- Which recording encodings are accepted by the selected batch provider?
- Which browsers and devices will be used in the live demo?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Standard: /spec-task -> /plan-task -> /implement-task -> /review-task.

Next step: `/spec-task recording-and-transcription`, using this brainstorm and [sprint breakdown](sprint.md).
