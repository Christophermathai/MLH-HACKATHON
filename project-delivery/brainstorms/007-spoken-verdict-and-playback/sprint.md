# Sprint: Spoken verdict, playback, and result screen

Status: proposed; all tasks pending.
Owner: Backend developer: TTS sequencing; frontend developer: player and verdict view.
Dependencies: 001 TTS decision, 002 audio contracts, 006 judge stream. Build against fake text/audio first.

## Ordered tasks

1. [ ] Finalize audio framing and build sentence splitting, concurrency limits, and ordered output.
2. [ ] Build the result view and player with mock out-of-order chunks.
3. [ ] Connect live TTS, fallback, cache/replay, completion handling, and text-only behavior.

## Delivery boundary

Text/audio completion rules, seq and replay semantics, audio queue state, provider fallback behavior, and session-scoped cached output. Unit 003 owns expiry; this unit supplies cache disposal.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
