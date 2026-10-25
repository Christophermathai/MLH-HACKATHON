# Speech provider feasibility

Status: superseded for STT by the user's 2026-10-25 selection of `openai/whisper-large-v3`; feature 001 implementation is partial/blocked on live inputs.
Complexity: needs brainstorming. Relative effort: S. Main risk: High.
Suggested owner: Backend developer; both participants judge sample quality.

## Problem and research

Establish whether the proposed speech providers can understand and speak the actual Malayalam and code-switched demo material before the rest of the build depends on them.

The original architecture proposed comparing multiple transcription candidates on five clips. The user subsequently selected `openai/whisper-large-v3`, so the implemented feature validates that one checkpoint against the five samples. TTS candidates, quotas, and live quality still require measured evidence.

Sources: [architecture](../../../zoomout_architecture.md), Sections 2, 4, 6, and 10; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Prepare five consented or synthetic clips with reference transcripts, including Malayalam, English mixing, hesitation, and background noise.
- Compare transcription errors, perceived meaning, latency, and streaming access using the same inputs.
- Test a neutral Malayalam judge line with and without emotion tags; select primary and fallback speech paths.
- Record actual model IDs, supported input/output formats, account access, limitations, and measured results.

Excluded: Do not build a benchmark platform, tune a custom model, or clone participant voices.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| Time-boxed provider comparison (recommended) | Measure the architecture's candidates against the same small sample set. | Finds demo-breaking language and account issues early. | Small sample cannot establish general quality. | Low | S |
| Commit to the named providers immediately | Begin SDK integration without a comparison. | Fastest initial setup. | May discover poor Malayalam or unavailable streaming late. | High | S |

## Recommended approach

Recommend a one-hour maximum spike, with a checkpoint early enough to unblock 004 and 007. Use mocks and typed text while access is pending. Record an explicit batch-first decision if streaming is unsuitable; preserve streaming verdict output.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: None. Run alongside 002.

Deliver to the next unit: A provider decision note and sample manifest, including audio encoding requirements, reference transcripts, latency observations, selected model IDs, and fallback policy. Keep participant recordings out of Git.

Likely files/systems: Proposed: scripts/provider-spike/, tests/fixtures/speech/ (synthetic fixtures only), project-delivery/features/speech-provider-feasibility/provider-results.md.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- Five clips have reference text and recorded results, or each blocked measurement has a stated reason.
- The selected TTS voice has a human-reviewed Malayalam sample.
- Downstream work knows whether input is streaming or batch and how tagged text is handled.

## Open decisions

- Which provider accounts and credits are available?
- Who can assess Malayalam quality, and what sample recordings may be retained?
- Which language should the final verdict use for mixed-language input?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Light: /spec-task -> /implement-task.

Next step: `/spec-task speech-provider-feasibility`, using this brainstorm and [sprint breakdown](sprint.md).
