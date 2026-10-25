# Integration, failure recovery, and demo readiness

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: M. Main risk: Medium.
Suggested owner: Both developers.

## Problem and research

Demonstrate one complete two-person journey and prove that interruptions do not break consent, privacy, or the final result.

The architecture targets a three-minute live demonstration with a prerecorded backup. There is no implemented app, deployment target, or end-to-end harness yet. Final integration cannot substitute for implementing consent and cleanup in earlier units.

Sources: [architecture](../../../zoomout_architecture.md), Sections 8, 9, 10, and 11; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Exercise two independent browser contexts from join through review, consent, and spoken verdict.
- Inject STT/TTS/LLM failures and network interruption to verify the agreed fallback paths.
- Verify raw-audio cleanup, session expiry, side isolation, and safe outcomes.
- Document local/demo deployment setup, rehearse the script, and prepare a matching prerecorded backup.

Excluded: No broad production launch, scaling program, analytics platform, or unreviewed retention of real disagreements.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| Mock-based integration plus a live rehearsal (recommended) | Run repeatable failure tests, then verify provider/device behavior in the demo environment. | Covers deterministic faults and real-world audio behavior. | Requires a small fixture set and provider access for the rehearsal. | Medium | M |
| Manual happy-path rehearsal only | Try the live scenario several times. | Quick and accessible. | Misses repeatable privacy, race, and fallback failures. | High | S |

## Recommended approach

Recommend continuously integrating with fixtures and using the final window for live checks and rehearsal. Publish observed results and explicit gaps; do not label mocked provider success as a live integration pass.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 002-007; provider decisions from 001. Start with mock integration as units land.

Deliver to the next unit: A reproducible demo runbook, observed verification report, fixture-backed scenarios, and labeled backup media with matching transcript/verdict.

Likely files/systems: Proposed: tests/e2e/, docs/demo-runbook.md, project-delivery/features/integration-and-demo-readiness/verification.md, demo/ (synthetic or consented assets only).
These are proposed locations, not existing code.

## Completion checks for the future implementation

- Both browser contexts complete the flow with edited transcripts and explicit consent.
- Single-consent, flagged-safety, invalid JSON, audio outage, and reconnect scenarios behave as specified.
- Microphones stop and raw audio/session artifacts are cleaned at the intended lifecycle points.
- The demo works on the chosen devices and network, with a verified text-only and prerecorded backup.

## Open decisions

- What URL/runtime and physical devices will host the demo?
- Who performs the two participant roles and the narration?
- Which known limitations must be included in the demo runbook?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Light: /spec-task -> /implement-task; then /review-task for the integrated MVP.

Next step: `/spec-task integration-and-demo-readiness`, using this brainstorm and [sprint breakdown](sprint.md).
