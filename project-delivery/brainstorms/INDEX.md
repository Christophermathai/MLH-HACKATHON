# ZoomOut brainstorms

Eight separately deliverable work units derived from [zoomout_architecture.md](../../zoomout_architecture.md). Each folder contains a brainstorm and a small sprint breakdown.

## Scope and research baseline

This breakdown assumes the architecture's two-developer hackathon MVP: two participants, Malayalam or mixed Malayalam-English input, three screens, and a spoken perspective/truce. The repository currently contains documentation and agent guidance, with no application code, package manifests, or prior feature delivery artifacts. CLAUDE.md, context/INDEX.md, project-delivery/decisions.md, and project-delivery/learnings.md were absent at inspection; the architecture and ZoomOut-specific agent context provide the available project direction.

Provider capabilities have not been independently verified. Unit 001 owns current documentation checks and empirical testing. Paths and framework choices below are proposals, not claims about an implemented app.

## Work units

| Unit | Work package | Effort | Primary handoff |
| --- | --- | --- | --- |
| 001 | [Speech provider feasibility](001-speech-provider-feasibility/brainstorm.md) | S | Provider decisions and tested audio formats |
| 002 | [Application foundation and shared contracts](002-foundation-and-contracts/brainstorm.md) | M | Runnable skeleton, validated schemas, and fake adapters |
| 003 | [Session gateway, participant isolation, and recovery](003-session-gateway-and-recovery/brainstorm.md) | M | Isolated sessions, readiness gate, and authorized reconnect |
| 004 | [Recording and transcription](004-recording-and-transcription/brainstorm.md) | L | Private editable transcript from speech |
| 005 | [Transcript review and consent](005-transcript-review-and-consent/brainstorm.md) | M | Confirmed edited text and explicit consent |
| 006 | [Analysis, mediation, judge text, and safety](006-analysis-mediation-and-safety/brainstorm.md) | L | Mediator result, safety outcome, and judge text stream |
| 007 | [Spoken verdict, playback, and result screen](007-spoken-verdict-and-playback/brainstorm.md) | L | Ordered spoken verdict, replay, and readable result |
| 008 | [Integration, failure recovery, and demo readiness](008-integration-and-demo-readiness/brainstorm.md) | M | Verified integrated journey and demo runbook |

S = narrow spike; M = several related tasks; L = integration-heavy work with multiple failure modes. These are relative sizes, not guaranteed hour estimates. Each unit is small enough to specify and review separately; individual sprint tasks are the implementation handoffs.

## Decomposition options considered

| Option | Benefit | Tradeoff | Decision |
| --- | --- | --- | --- |
| One brainstorm for the entire MVP | One document | Too many unresolved interfaces and no clear ownership | Rejected |
| Separate frontend, backend, and AI projects | Easy role assignment | Delays integration and scatters consent/audio responsibilities | Rejected |
| Eight units with explicit contracts and handoffs | Independent progress with observable completion checks | Requires early agreement on shared events | Recommended |

The architecture's analyst, mediator, and judge are application runtime roles. They are grouped in 006 because their schemas and safety branch form one coherent pipeline; the agent helper files in .agents are development guidance.

## Shared decisions to settle

- Node versus FastAPI gateway; Node is recommended for shared TypeScript contracts.
- Streaming versus batch input after provider testing; batch-first is recommended for the six-hour target.
- Room creation, participant binding, resume credentials, and expiry.
- Event envelope, encoded audio framing, typed-input transition, safety-result contract, and done semantics.
- Post-confirmation edits/withdrawal, verdict language, petty-score range, and text/recording limits.

Existing event names from architecture section 7 remain the baseline. Additions must be explicit in the feature specs rather than invented independently by each developer.

## Next step

Specifications, phased plans, and document review notes are now available for all eight units in the [feature delivery index](../features/INDEX.md). Use [sprint.md](sprint.md) to coordinate the two developers, starting with provider feasibility and foundation. The feature packages record explicit working defaults and unstarted implementation status.
