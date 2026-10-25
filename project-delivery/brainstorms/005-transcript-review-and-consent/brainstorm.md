# Transcript review and consent

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: M. Main risk: High.
Suggested owner: Frontend developer, with gateway enforcement by backend developer.

## Problem and research

Ensure that each participant controls the text attributed to them and explicitly consents before the two sides are compared.

confirm_transcript contains text and consent: true; the analyst input must be the confirmed transcript. The architecture requires an editable review screen and a privacy notice, but does not specify withdrawal, post-confirmation editing, or empty submission behavior.

Sources: [architecture](../../../zoomout_architecture.md), Sections 3, 4, 7, and 8; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Show editable final text and recognition uncertainty to the owning participant.
- Offer typed text through the same review and confirmation flow.
- Require explicit consent and server validation before the side becomes ready.
- Show waiting/readiness progress without revealing the other participant's content.

Excluded: No automatic consent, preselected agreement, forced reconciliation, or shared transcript editor.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| One explicit confirm-and-share action (recommended) | Keep editing and an unchecked consent control together; submit once. | Matches the architecture and reduces mismatched state. | Must clearly state what is shared and when. | Medium | M |
| Separate confirmation and consent stages | Confirm text first and share in a second step. | More deliberate decision points. | Additional UI and protocol states for a three-screen MVP. | Medium | M |

## Recommended approach

Recommend one validated confirm-and-share action using the edited text. For MVP, propose locking a confirmed transcript and offering a new session for changes; finalize this policy before implementing retries and recovery.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 002 contracts and 003 confirmation API. Use typed/mock transcripts before 004.

Deliver to the next unit: Validated confirmed text and consent bound to its revision; ready/waiting UI states. The gateway remains authoritative when a client is bypassed or reconnects.

Likely files/systems: Proposed: app/frontend/src/features/review/, app/api/src/sessions/confirmation.*, tests/fixtures/consent/.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- Editing recognition errors changes the text actually passed to the analyst.
- Empty text or missing consent is rejected both in the UI and gateway.
- The first participant sees a waiting state, never the other's private transcript.
- Double submission, reconnect, and typed entry preserve consent semantics.

## Open decisions

- Should confirmation lock text or support withdrawal before mediation?
- What input length and empty/whitespace rules should apply?
- What concise consent copy should explain provider processing and sharing?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Light: /spec-task -> /implement-task; include a focused privacy review before integration.

Next step: `/spec-task transcript-review-and-consent`, using this brainstorm and [sprint breakdown](sprint.md).
