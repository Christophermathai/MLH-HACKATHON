# Spoken verdict, playback, and result screen

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: L. Main risk: High.
Suggested owner: Backend developer: TTS sequencing; frontend developer: player and verdict view.

## Problem and research

Make the verdict start speaking promptly, remain in order, and stay usable when speech synthesis or playback fails.

The architecture calls for sentence-level synthesis, at most two concurrent requests, seq-numbered chunks, session caching, and a readable verdict. It leaves MIME framing, missing-chunk handling, final-chunk completion, and reconnect replay behavior unspecified.

Sources: [architecture](../../../zoomout_architecture.md), Sections 5.3, 6, 7, and 9; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Split streamed judge tokens into complete sentences, retaining incomplete text and emotion tags safely.
- Synthesize at most two sentences concurrently and assign deterministic ordering independent of completion time.
- Build an ordered browser audio queue with play/pause/replay and a readable growing verdict.
- Render mediator perspective/truce, implement TTS fallback, and cache session audio for replay.

Excluded: No participant voice cloning, guaranteed word-level alignment without timestamps, music production, or permanent public replay links.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| Sentence-based streaming with ordered playback (recommended) | Start synthesis when a complete sentence is available. | Preserves the architecture's early spoken verdict. | Requires careful framing and gap/completion handling. | High | L |
| Synthesize the entire verdict after generation | Buffer full judge text before one TTS call. | Simpler audio assembly. | Delays the key demo moment; reserve as a fallback. | Low | S |

## Recommended approach

Recommend streaming output even when input is batch-first. Define whether each transmitted audio chunk is independently decodable or needs stream assembly. Preserve a complete text result on synthesis failure; use prerecorded audio only for an explicitly identified matching demo scenario.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 001 TTS decision, 002 audio contracts, 006 judge stream. Build against fake text/audio first.

Deliver to the next unit: Text/audio completion rules, seq and replay semantics, audio queue state, provider fallback behavior, and session-scoped cached output. Unit 003 owns expiry; this unit supplies cache disposal.

Likely files/systems: Proposed: app/api/src/audio/, app/api/src/providers/tts/, app/frontend/src/features/verdict/, app/frontend/src/audio/.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- A slow first TTS request cannot cause later sentences to play first.
- Split tokens, Malayalam boundaries, final unpunctuated text, and tags are handled correctly.
- Pause, resume, replay, duplicate chunks, and a missing/failed chunk have defined behavior.
- All TTS failing still leaves the complete verdict and truce readable.
- Replay reuses cached audio; session expiry disposes of it.

## Open decisions

- What exact MIME/codec and chunk framing can the selected provider and browser share?
- How will completion distinguish model text finished from all audio delivered?
- How should playback continue after one failed sentence or a reconnect?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Standard: /spec-task -> /plan-task -> /implement-task -> /review-task.

Next step: `/spec-task spoken-verdict-and-playback`, using this brainstorm and [sprint breakdown](sprint.md).
