# Application foundation and shared contracts

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: M. Main risk: Medium.
Suggested owner: Frontend developer leads scaffold; backend developer reviews contracts.

## Problem and research

Give two developers a runnable shared foundation and explicit interfaces so browser, gateway, and AI work can progress independently.

There are no application directories, package manifests, schemas, or tests. The agent context suggests app/frontend and app/api, but these are proposed locations. The architecture permits Node or FastAPI and does not define the event envelope, room creation, resume credentials, safety response payload, or typed-input transition.

Sources: [architecture](../../../zoomout_architecture.md), Sections 1, 2, 3, 5, and 7; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Scaffold Next.js, TypeScript, and Tailwind with a minimal gateway and documented local commands.
- Define event payloads, analyst and mediator schemas, provider interfaces, and mocked event fixtures.
- Resolve transport encoding, room creation/join/resume, participant binding, typed submission, and safety response contracts.
- Document which fields are private, which can be shared, and when done is emitted.

Excluded: No complete UI, real speech integration, Redis, queues, or persistent account system.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| TypeScript client and Node gateway (recommended) | Share runtime schemas and types across browser and gateway. | One language and easy contract sharing. | Still needs a WebSocket-capable runtime and launch setup. | Medium | M |
| TypeScript client and FastAPI gateway | Use Python services with equivalent validated wire schemas. | Good choice if the backend developer is stronger in Python. | Extra cross-language schema synchronization. | Medium | M |

## Recommended approach

Recommend Node plus in-memory session state for the hackathon unless team experience favors FastAPI. This is a proposed implementation choice, not an existing repository constraint. Preserve architecture event names; document and approve necessary protocol additions as part of the spec.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: None. Provider interfaces can initially use mocks.

Deliver to the next unit: Shared event/schema package, fake STT/LLM/TTS adapters, example event traces, and a local startup guide. Unit 003 owns transition semantics; this unit owns the common transport shape.

Likely files/systems: Proposed: app/frontend/, app/api/, packages/contracts/, tests/fixtures/events/, .env.example (placeholders only).
These are proposed locations, not existing code.

## Completion checks for the future implementation

- Frontend and gateway start with the documented commands and no live provider credentials.
- Valid fixtures parse and invalid payloads are rejected.
- Both developers agree on event envelope, binary versus encoded audio, private fields, resume flow, and completion semantics.

## Open decisions

- Node or FastAPI based on the team's strongest skills?
- What WebSocket-capable demo hosting environment will be used?
- What score range and session expiry should the schemas enforce?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Standard: /spec-task -> /plan-task -> /implement-task -> /review-task.

Next step: `/spec-task foundation-and-contracts`, using this brainstorm and [sprint breakdown](sprint.md).
