# ZoomOut feature delivery index

Eight feature packages expand the [brainstorms](../brainstorms/INDEX.md) into 64 individual functional requirements, 64 acceptance criteria, 24 edge cases, and 24 implementation phases.

The requested documentation is prepared. Feature 001 has started: its Whisper Large v3 harness, manifest, scoring tests, and partial report are implemented, while live speech measurements remain blocked. Features 002-008 have not started. The [shared decisions](../decisions.md) explain choices that were open in the brainstorms.

## Feature documents

| Feature | Requirements | Specification | Plan | Review notes | Execution |
| --- | --- | --- | --- | --- | --- |
| 001: Speech provider feasibility | 8 | [Spec](001-speech-provider-feasibility/spec.md) | [Plan](001-speech-provider-feasibility/plan.md) | [Audit](001-speech-provider-feasibility/audit.md) | [Status](001-speech-provider-feasibility/status.md) |
| 002: Application foundation and shared contracts | 8 | [Spec](002-foundation-and-contracts/spec.md) | [Plan](002-foundation-and-contracts/plan.md) | [Audit](002-foundation-and-contracts/audit.md) | [Status](002-foundation-and-contracts/status.md) |
| 003: Session gateway, participant isolation, and recovery | 8 | [Spec](003-session-gateway-and-recovery/spec.md) | [Plan](003-session-gateway-and-recovery/plan.md) | [Audit](003-session-gateway-and-recovery/audit.md) | [Status](003-session-gateway-and-recovery/status.md) |
| 004: Recording and transcription | 8 | [Spec](004-recording-and-transcription/spec.md) | [Plan](004-recording-and-transcription/plan.md) | [Audit](004-recording-and-transcription/audit.md) | [Status](004-recording-and-transcription/status.md) |
| 005: Transcript review and consent | 8 | [Spec](005-transcript-review-and-consent/spec.md) | [Plan](005-transcript-review-and-consent/plan.md) | [Audit](005-transcript-review-and-consent/audit.md) | [Status](005-transcript-review-and-consent/status.md) |
| 006: Analysis, mediation, judge text, and safety | 8 | [Spec](006-analysis-mediation-and-safety/spec.md) | [Plan](006-analysis-mediation-and-safety/plan.md) | [Audit](006-analysis-mediation-and-safety/audit.md) | [Status](006-analysis-mediation-and-safety/status.md) |
| 007: Spoken verdict, playback, and result screen | 8 | [Spec](007-spoken-verdict-and-playback/spec.md) | [Plan](007-spoken-verdict-and-playback/plan.md) | [Audit](007-spoken-verdict-and-playback/audit.md) | [Status](007-spoken-verdict-and-playback/status.md) |
| 008: Integration, failure recovery, and demo readiness | 8 | [Spec](008-integration-and-demo-readiness/spec.md) | [Plan](008-integration-and-demo-readiness/plan.md) | [Audit](008-integration-and-demo-readiness/audit.md) | [Status](008-integration-and-demo-readiness/status.md) |

Each package also contains decisions.md and implementation-notes.md. The latter has an empty execution record so later work cannot confuse these documents with completed code.

## Navigation and execution order

- [Requirement matrix](requirements-matrix.md): every FR mapped to its acceptance criterion, phase, and audit.
- [Combined review notes](review-notes.md): findings, fixes, and verification limits.
- [Shared protocol](002-foundation-and-contracts/spec.md#protocol-and-data-appendix): explicit events, models, bounds, and lifecycle.
- [Original two-developer sprint](../brainstorms/sprint.md): hackathon target; actual completion depends on evidence.

Start 001 (provider feasibility) and 002 (foundation) in parallel. Then 003 enables 005 (review/consent) and 004 (voice input). Typed input unblocks 006 (AI pipeline) before voice integration is ready. Feature 007 adds spoken output; 008 verifies the combined journey. Fake interfaces let individual phases begin sooner without declaring live dependencies complete.

Feature 004 P3 / FR-004-04 and FR-004-05 are optional streaming-input scope. The batch MVP still requires all other input and cleanup checks; optional streaming must be marked DEFERRED explicitly if omitted.

## How to use a package

Read spec.md for behavior, plan.md for phases, decisions.md for defaults, and status.md for the execution checkpoint. When implementation is requested, follow the plan and append actual evidence to implementation-notes.md. Rerun review-task against the resulting code; the current audit is a document-readiness review only.
