# Spoken verdict, playback, and result screen: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Backend developer for TTS; frontend developer for playback.
Input research: [brainstorm](../../brainstorms/007-spoken-verdict-and-playback/brainstorm.md), [brainstorm sprint](../../brainstorms/007-spoken-verdict-and-playback/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns sentence splitting, TTS scheduling, audio manifests/cache, player state, and result view. 006 owns verdict content; 003 owns authorization and expiry.

Assign seq from 0 before dispatch. Use at most two concurrent sentence jobs, counting fallback inside the same slot. Each audio_chunk is one complete independently decodable sentence clip; aggregate provider transport fragments before sending. Use a tested MIME from 001; validate PCM-WAV or provider format in target browsers. A 20-second deadline applies to each provider attempt; try one configured fallback once.

Dependencies: [001-speech-provider-feasibility](../001-speech-provider-feasibility/status.md), [002-foundation-and-contracts](../002-foundation-and-contracts/status.md), [003-session-gateway-and-recovery](../003-session-gateway-and-recovery/status.md), [006-analysis-mediation-and-safety](../006-analysis-mediation-and-safety/status.md)

Critical path: 001 + 002 + 003 + 006 -> P1 -> P2 -> P3.

Riskiest work: Build sentence scheduler; Build verdict view and player; Integrate completion and lifecycle. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Build sentence scheduler

Goal: build sentence scheduler and satisfy FR-007-01, FR-007-02, FR-007-03.
Risk: High.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `app/api/src/audio/sentences.ts`, `app/api/src/audio/scheduler.ts`, `app/api/src/providers/tts/`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Implement token-safe sentence splitting and seq assignment.
2. Normalize complete clips and cap concurrent jobs at two.
3. Add primary/fallback deadlines and explicit failed-sequence settlement.

Verification: Use reversed/failed fake responses and split-token fixtures; decode one real clip when 001 provides verified configuration.
Acceptance IDs: AC-007-01, AC-007-02, AC-007-03. Also exercise all related edge cases in spec.md.

Avoid: Do not equate an SDK transport chunk with a playable clip or allocate seq after completion.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Build verdict view and player

Goal: build verdict view and player and satisfy FR-007-04, FR-007-05, FR-007-06.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/frontend/src/features/verdict/`, `app/frontend/src/audio/`, `app/api/src/audio/cache.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Render display text and mediator/safety/incomplete outcomes.
2. Implement ordered queue, failed-gap handling, play/pause, activation, and replay.
3. Connect authorized cache retrieval without additional model calls.

Verification: Use fake out-of-order chunks and browser audio fixtures; test pause offsets, duplicate replay, all-audio failure, and provider call counters. Make a server-ready clip fail local decoding and verify this client skips it with a notice, plays the next clip, and leaves the server manifest unchanged.
Acceptance IDs: AC-007-04, AC-007-05, AC-007-06. Also exercise all related edge cases in spec.md.

Avoid: Do not claim word-level sync or replace a live verdict with unrelated demo audio.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Integrate completion and lifecycle

Goal: integrate completion and lifecycle and satisfy FR-007-07, FR-007-08.
Risk: High.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/audio/manifest.ts`, `app/frontend/src/audio/lifecycle.ts`, `tests/e2e/playback.spec.ts`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Publish final manifests before terminal done and integrate judge failure/cancellation.
2. Implement expiry disposal and generation guards across server/client.
3. Run codec, reconnect, and live sentence-latency checks on the demo browser.

Verification: Test late job, missing clip, fatal judge error, expiry mid-playback, and done-before-playback-finish semantics.
Acceptance IDs: AC-007-07, AC-007-08. Also exercise all related edge cases in spec.md.

Avoid: Do not leave a pending gap unresolved or let expired cached audio replay.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-007-01 | AC-007-01 | P1 | Not implemented / not run |
| FR-007-02 | AC-007-02 | P1 | Not implemented / not run |
| FR-007-03 | AC-007-03 | P1 | Not implemented / not run |
| FR-007-04 | AC-007-04 | P2 | Not implemented / not run |
| FR-007-05 | AC-007-05 | P2 | Not implemented / not run |
| FR-007-06 | AC-007-06 | P2 | Not implemented / not run |
| FR-007-07 | AC-007-07 | P3 | Not implemented / not run |
| FR-007-08 | AC-007-08 | P3 | Not implemented / not run |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Live codec compatibility and first-sentence latency require real provider/browser evidence. Sentence clips preserve streaming output but do not promise provider-fragment playback or word-level alignment.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 007-spoken-verdict-and-playback. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
