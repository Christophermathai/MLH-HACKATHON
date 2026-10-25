# Sprint: Analysis, mediation, judge text, and safety

Status: proposed; all tasks pending.
Owner: Backend developer.
Dependencies: 002 JSON schemas, 003 readiness gate, 005 confirmed transcript semantics. Fixtures allow independent prompt work.

## Ordered tasks

1. [ ] Define prompt/schema fixtures and validation/retry behavior.
2. [ ] Wire isolated analysts, the both-ready mediator gate, and the safety branch.
3. [ ] Stream judge text; review ordinary, unclear, malformed, and safety cases.

## Delivery boundary

Validated mediator output, judge text deltas, or a calm safety result with an agreed contract. Unit 007 consumes text; private analyst fields stay inside the gateway.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
