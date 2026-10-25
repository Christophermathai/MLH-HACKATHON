# Spoken verdict, playback, and result screen: functional specification

Status: draft specification prepared for planning and document review, 2026-10-25. Implementation has not started; requirements and default choices have not been individually approved by the user.
Owner: Backend developer for TTS; frontend developer for playback.

## Overview

Speak completed verdict sentences promptly and in order, while retaining readable text, mediator perspective, a truce, and free session replay.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 5.3, 6, 7, 9; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/007-spoken-verdict-and-playback/brainstorm.md) and [sprint](../../brainstorms/007-spoken-verdict-and-playback/sprint.md).

## Changes and ownership

Owns sentence splitting, TTS scheduling, audio manifests/cache, player state, and result view. 006 owns verdict content; 003 owns authorization and expiry.

## Explicit working defaults

Assign seq from 0 before dispatch. Use at most two concurrent sentence jobs, counting fallback inside the same slot. Each audio_chunk is one complete independently decodable sentence clip; aggregate provider transport fragments before sending. Use a tested MIME from 001; validate PCM-WAV or provider format in target browsers. A 20-second deadline applies to each provider attempt; try one configured fallback once.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-007-01

Split judge text incrementally on sentence punctuation including Malayalam danda while preserving token-spanning tags and trailing text. Dispatch the first complete sentence before waiting for the whole verdict; flush the final unpunctuated fragment once.

### FR-007-02

Assign seq before synthesis and limit active sentence jobs to two. Normalize TTS output into a complete decodable clip with declared MIME; neither completion order nor provider fragment order may change sentence order.

### FR-007-03

Try the configured primary once per sentence and one fallback on failure/timeout. Mark exhausted sentences failed in audio_status; keep display text and continue later resolved sentences. Use one neutral voice per provider configuration.

### FR-007-04

Render mediator perspectives, zoom-out, optional truce, and streamed display text. Keep text readable during buffering, full audio outage, safety outcome, and incomplete generation; never show tags as spoken text.

### FR-007-05

Play available clips in ascending seq, deduplicate replays, and offer play/pause plus full replay. Skip clips marked failed by the server or explicitly recorded as a local decode failure; local failures affect only this client's playback and never rewrite the server manifest. Respect browser activation restrictions with a visible Play action; resume a paused clip at its stored offset.

### FR-007-06

Cache successful clips and the manifest only for the live session. Replay and reconnect fetch cached clips through the bound participant connection without regenerating text or speech; full replay is enabled after output resolves.

### FR-007-07

Resolve audio_status for every dispatched seq, emit a final manifest with totalSentences and textComplete, then done only after all jobs settle. done means server delivery resolved, not playback finished; failed judge output is not presented as complete.

### FR-007-08

On expiry, cancellation, or fatal judge failure, stop/dispose appropriate jobs and queue references, reject late clips, and keep only authorized non-expired session data. Document and test MIME decoding and cleanup on the demo browser.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-007-01 | FR-007-01 | Given tokens split across punctuation/tags and a final fragment, each sentence is synthesized exactly once and the first job starts before the judge stream ends. |
| AC-007-02 | FR-007-02 | Given sentence 1 completes before sentence 0, transmitted/queued metadata keeps seq identity and playback still starts at 0; no partial codec fragment is treated as a complete clip. |
| AC-007-03 | FR-007-03 | Given primary and fallback fail for seq 1, the manifest marks it failed and the player advances to seq 2 with a visible audio notice; no wait remains on seq 1. |
| AC-007-04 | FR-007-04 | Given all synthesis fails, the complete successful judge text and truce remain usable; safety and incomplete outcomes have distinct labels and no misleading score. |
| AC-007-05 | FR-007-05 | Given out-of-order/duplicate delivery, pause during a sentence, or blocked autoplay, controls recover without repeated successful clips. A server-ready clip that fails local decoding produces an audio notice and allows later playable clips to continue without changing the server manifest. |
| AC-007-06 | FR-007-06 | Given repeated replay or reconnect, provider call counts stay unchanged and the player restarts from seq 0 only on deliberate replay. |
| AC-007-07 | FR-007-07 | Given one failed clip or a late job, done follows the final manifest and no pending gap is silently ignored; client playback can continue after done. |
| AC-007-08 | FR-007-08 | Given expiry mid-playback or a late result from an obsolete generation, the player stops, caches clear, and no stale audio is appended to a new session. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-007-01 | Gap, duplicate, and out-of-order clips | Wait for pending seq and ignore duplicates. Skip server-failed seq after audio_status/final manifest, or a locally recorded decode failure for this client only. | FR-007-02, FR-007-03, FR-007-05, FR-007-07 |
| EC-007-02 | Fallback codec differs or a browser rejects decode | Normalize/declare MIME correctly; mark locally unplayable clip and retain text with an audio notice. | FR-007-02, FR-007-03, FR-007-04, FR-007-08 |
| EC-007-03 | Safety outcome or judge failure after partial speech | Do not start playful TTS for safety; stop queued playback on fatal judge failure and mark retained text incomplete. | FR-007-04, FR-007-07, FR-007-08 |

## Dependencies

- [001-speech-provider-feasibility](../001-speech-provider-feasibility/spec.md)
- [002-foundation-and-contracts](../002-foundation-and-contracts/spec.md)
- [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/spec.md)
- [006-analysis-mediation-and-safety](../006-analysis-mediation-and-safety/spec.md)

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Word-level synchronization without timestamps, participant voice cloning, permanent public recordings, unrelated canned verdict substitutions, or a full audio editor.

## Readiness and execution prerequisites

Live codec compatibility and first-sentence latency require real provider/browser evidence. Sentence clips preserve streaming output but do not promise provider-fragment playback or word-level alignment.

Provider credentials, model configuration, a human reviewer, and devices are execution inputs where applicable, not missing definitions of user behavior. Record their availability during implementation. No live API call, provider documentation verification, human-language assessment, or product test was performed for this specification.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.
