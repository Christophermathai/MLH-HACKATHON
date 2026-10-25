# Sprint: Integration, failure recovery, and demo readiness

Status: proposed; all tasks pending.
Owner: Both developers.
Dependencies: 002-007; provider decisions from 001. Start with mock integration as units land.

## Ordered tasks

1. [ ] Integrate a mock end-to-end path and add targeted failure scenarios.
2. [ ] Verify live providers, privacy/cleanup, reconnect, and playback on demo devices.
3. [ ] Prepare the backup, rehearse the three-minute story, and record passed checks and limitations.

## Delivery boundary

A reproducible demo runbook, observed verification report, fixture-backed scenarios, and labeled backup media with matching transcript/verdict.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
