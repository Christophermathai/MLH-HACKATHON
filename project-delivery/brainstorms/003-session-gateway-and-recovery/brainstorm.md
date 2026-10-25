# Session gateway, participant isolation, and recovery

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: M. Main risk: High.
Suggested owner: Backend developer.

## Problem and research

Coordinate two independent participants without exposing private content, mixing their recordings, or running the verdict twice.

The state diagram lists A then B but explicitly permits concurrent recording. Model per-side progress independently and derive session readiness. A room code plus a client-supplied side is not sufficient proof of ownership for reconnecting to private transcript state.

Sources: [architecture](../../../zoomout_architecture.md), Sections 3, 7, 8, and 9; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Implement room creation/join and server-bound participant identity.
- Track each side's recording, transcription, review, confirmation, and consent separately.
- Trigger mediation exactly once when both confirmed analyses are available and consent is valid.
- Recover authorized session state after reconnect, handle duplicate events, and expire abandoned sessions.

Excluded: No cross-process persistence, multi-region synchronization, user profiles, or distributed queues. In-memory sessions do not survive gateway restarts.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| In-memory session service (recommended) | Use one authoritative service with explicit transitions and participant bindings. | Small implementation and fast local iteration. | Restart loses sessions; requires one gateway instance for the demo. | Medium | M |
| SQLite-backed sessions | Persist session records and transition state locally. | Can recover across process restart. | More cleanup, migrations, and concurrency work. | Medium | L |

## Recommended approach

Recommend an in-memory session service with bounded retention and idempotent transition handling. Keep side analyses server-private even after consent; broadcast only the mediator output required by the architecture.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 002 contracts. Can use fake providers before 004 and 006.

Deliver to the next unit: Session API for ingest, final transcript, confirmation, analyst result, and completion; authorized resume snapshot; typed transition errors. Define whether expired or failed sessions can be retried.

Likely files/systems: Proposed: app/api/src/sessions/, app/api/src/transport/, app/api/tests/sessions/.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- A and B can record concurrently; one participant cannot claim the other's side or read their transcript.
- No shared analysis event appears with only one consent flag.
- Repeated confirmations and reconnects do not trigger duplicate paid generation.
- Expiry removes session transcripts, analysis, and cached artifacts; reconnect to an expired session fails clearly.

## Open decisions

- What retention period and room-code generation rules fit the demo?
- How will participant resume credentials be issued and supplied?
- Can confirmed text be changed, or must the participant start a new session?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Standard: /spec-task -> /plan-task -> /implement-task -> /review-task.

Next step: `/spec-task session-gateway-and-recovery`, using this brainstorm and [sprint breakdown](sprint.md).
