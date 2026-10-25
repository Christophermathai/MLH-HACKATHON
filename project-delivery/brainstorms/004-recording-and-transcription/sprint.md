# Sprint: Recording and transcription

Status: proposed; all tasks pending.
Owner: Frontend developer: capture; backend developer: STT adapter.
Dependencies: 001 provider formats, 002 contracts, 003 session API. Mock development can start after 002.

## Ordered tasks

1. [ ] Implement recording controls and a typed-input escape route against mocks.
2. [ ] Integrate the selected batch adapter and raw-audio cleanup.
3. [ ] Add PCM streaming/resampling and partial events if time permits; verify the fallback and microphone lifecycle.

## Delivery boundary

One final transcript per side, optional partial events, sanitized errors, and recording cleanup guarantees. Unit 005 owns editing and consent; unit 003 owns state transitions.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
