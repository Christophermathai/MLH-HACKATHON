# Sprint: Transcript review and consent

Status: proposed; all tasks pending.
Owner: Frontend developer, with gateway enforcement by backend developer.
Dependencies: 002 contracts and 003 confirmation API. Use typed/mock transcripts before 004.

## Ordered tasks

1. [ ] Build review, uncertainty display, typed entry, and explicit consent controls.
2. [ ] Connect confirmation to the gateway and implement ready/waiting/retry states.
3. [ ] Verify edited-text propagation, missing consent, duplicate submit, and reconnect behavior.

## Delivery boundary

Validated confirmed text and consent bound to its revision; ready/waiting UI states. The gateway remains authoritative when a client is bypassed or reconnects.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
