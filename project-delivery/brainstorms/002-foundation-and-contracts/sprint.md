# Sprint: Application foundation and shared contracts

Status: proposed; all tasks pending.
Owner: Frontend developer leads scaffold; backend developer reviews contracts.
Dependencies: None. Provider interfaces can initially use mocks.

## Ordered tasks

1. [ ] Choose gateway language and scaffold the client and gateway.
2. [ ] Write shared contracts and explicit decisions for protocol gaps.
3. [ ] Add fake adapters and a browser-to-gateway smoke flow; document startup.

## Delivery boundary

Shared event/schema package, fake STT/LLM/TTS adapters, example event traces, and a local startup guide. Unit 003 owns transition semantics; this unit owns the common transport shape.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
