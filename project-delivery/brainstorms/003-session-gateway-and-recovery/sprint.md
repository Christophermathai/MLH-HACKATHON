# Sprint: Session gateway, participant isolation, and recovery

Status: proposed; all tasks pending.
Owner: Backend developer.
Dependencies: 002 contracts. Can use fake providers before 004 and 006.

## Ordered tasks

1. [ ] Implement separate side states, participant binding, and validated join.
2. [ ] Add exactly-once readiness/generation guards and restricted event routing.
3. [ ] Add reconnect snapshots, expiry, and tests for parallel sides, duplicate events, and unauthorized access.

## Delivery boundary

Session API for ingest, final transcript, confirmation, analyst result, and completion; authorized resume snapshot; typed transition errors. Define whether expired or failed sessions can be retried.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
