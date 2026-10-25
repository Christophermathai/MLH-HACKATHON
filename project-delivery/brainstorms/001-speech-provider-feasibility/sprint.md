# Sprint: Speech provider feasibility

Status: superseded by feature 001 status; harness/reporting implemented, live speech measurements blocked.
Owner: Backend developer; both participants judge sample quality.
Dependencies: None. Run alongside 002.

## Ordered tasks

1. [ ] Prepare reference clips and a compact scoring sheet.
2. [ ] Verify current official provider docs and runtime capabilities; run Whisper Large v3 on all five samples and test TTS candidates.
3. [ ] Publish the selected providers, formats, fallback decisions, and unresolved access issues.

## Delivery boundary

A provider decision note and sample manifest, including audio encoding requirements, reference transcripts, latency observations, selected model IDs, and fallback policy. Keep participant recordings out of Git.

Use the completion checks in [brainstorm.md](brainstorm.md) before handing off. Integrate against mocks when upstream live providers are unavailable; explicitly record what remains unverified. Do not mark the unit complete merely because its time box ended.

## Coordination

See the [shared delivery order](../sprint.md) for parallel work and integration checkpoints. Changes to shared contracts must be reflected in 002 and communicated to dependent units before implementation diverges.
