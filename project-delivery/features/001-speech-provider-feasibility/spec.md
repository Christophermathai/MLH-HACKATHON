# Speech provider feasibility: functional specification

Status: approved for implementation with user-directed Whisper Large v3 STT, 2026-10-25.
Owner: Backend developer; Malayalam-speaking reviewer.

## Overview

Validate the selected Whisper Large v3 STT configuration and compare usable TTS configurations using a bounded, repeatable Malayalam sample set. Deliver measured evidence so input and output adapters can be implemented without guessing provider capability.

Actors: participants A and B, the browser, gateway, and configured providers; the developer/reviewer operates feasibility and verification tasks.

## What exists today

Repository inspection found the architecture, agent guidance, and eight brainstorm packages. There is no application source, package manifest, implemented provider adapter, or runnable product test suite. CLAUDE.md, context/INDEX.md, prior decisions/learnings, and prior feature specs were absent at inspection. Sources: [architecture](../../../zoomout_architecture.md), sections 2, 4, 6, 10; [ZoomOut context](../../../.agents/project-context.md); [matching brainstorm](../../brainstorms/001-speech-provider-feasibility/brainstorm.md) and [sprint](../../brainstorms/001-speech-provider-feasibility/sprint.md).

## Changes and ownership

Owns provider evidence and selection. Feature 002 owns application contracts; 004 and 007 own production adapters.

## Explicit working defaults

Use five synthetic or explicitly consented samples. The user selected the official `openai/whisper-large-v3` checkpoint as the sole STT candidate, run locally through a supported Transformers pipeline in batch mode with Malayalam language prompting. Compare the proposed ElevenLabs voice with Google TTS fallback. TTS candidates remain unverified until measured. Cap the spike at one hour and publish a partial report if model execution, samples, or human review are unavailable.

These choices make the documents concrete and internally consistent. They are proposed defaults for this delivery set, not claims that the brainstorm's questions were answered by the user. [Shared decisions](../../decisions.md) records their rationale and change impact.

## Functional requirements

### FR-001-01

Create a five-item sample manifest covering Malayalam-only, Malayalam-English switching, hesitation/unclear speech, background noise, and an everyday disagreement. Include reference text, duration, provenance/permission, and a private-local or synthetic fixture reference.

### FR-001-02

Verify Whisper Large v3 and each TTS candidate against current official documentation and the actual execution environment/account; record exact model ID, revision when available, date, language, device/dtype, encoding, batch/streaming access, quotas, and source URLs. Mark unavailable candidates explicitly.

### FR-001-03

Run Whisper Large v3 on all five audio inputs with one documented preprocessing and decoding configuration. Record output, elapsed time, normalized word edits against the reference, and a human judgment of meaning preservation.

### FR-001-04

Approve Whisper Large v3 for the MVP only if the five-sample run and Malayalam human review preserve meaning at an acceptable level. Otherwise mark STT readiness blocked and hand off typed input; use batch mode because this spike does not validate true streaming inference.

### FR-001-05

Test a neutral Malayalam TTS sentence both with and without emotion tags and compare the candidate fallback. Record intelligibility, whether tags are spoken aloud, codec, latency, and voice configuration.

### FR-001-06

Publish provider-results.md with explicit primary/fallback choices, input/output formats, a single neutral voice policy, limitations, and separate measured/documented/unverified fields.

### FR-001-07

Keep credentials in local environment configuration and remove raw consented sample audio after the spike. Retain synthetic samples and derived metrics only; redact private transcript examples from shared reports.

### FR-001-08

Stop at the one-hour checkpoint, publish completion/blocked status per measurement, and hand off typed/mock paths when live access is unavailable. A blocked report must not certify voice readiness.

## Acceptance criteria

| ID | Requirement | Observable evidence required |
| --- | --- | --- |
| AC-001-01 | FR-001-01 | Given the manifest, a reviewer can identify five distinct scenarios and the authorized reference transcript for each without private audio entering Git. |
| AC-001-02 | FR-001-02 | Given an inaccessible candidate, its report says blocked with a concrete cause; another model's capabilities are never substituted without being named. |
| AC-001-03 | FR-001-03 | Given five available samples, the report contains five Whisper Large v3 results with one reproducible configuration, normalization rules, timings, word edits, and any omissions stated. |
| AC-001-04 | FR-001-04 | Given the five-sample results, another developer can reproduce the approval decision and determine that the validated path is batch mode without inferring undocumented preferences. |
| AC-001-05 | FR-001-05 | Given a TTS result that speaks tags aloud, the selection requires stripping tags and includes a verified untagged sample before approving live use. |
| AC-001-06 | FR-001-06 | Given the report, features 004 and 007 can configure their adapters from exact identifiers and formats; blocked fields remain explicitly blocked rather than marked successful. |
| AC-001-07 | FR-001-07 | Given a completed spike, repository inspection finds no credentials or private audio and the report records what was retained or removed. |
| AC-001-08 | FR-001-08 | Given no working credentials at the checkpoint, dependent mock work can proceed while live speech readiness remains unverified. |

## Edge cases

| ID | Trigger | Required outcome | Requirements |
| --- | --- | --- | --- |
| EC-001-01 | Whisper model or TTS provider is inaccessible | Record the blocked measurement and do not certify the affected speech path. Typed/mock paths remain available. | FR-001-02, FR-001-04, FR-001-08 |
| EC-001-02 | No Malayalam reviewer or permitted sample source | Leave human quality validation blocked; synthetic fixtures can still exercise the harness. | FR-001-01, FR-001-03, FR-001-05, FR-001-08 |
| EC-001-03 | Emotion tags degrade speech or fallback uses another voice | Strip tags; document a neutral fallback voice and never imitate a participant. | FR-001-05, FR-001-06 |

## Dependencies

None. This feature can start alongside the other foundation work.

The [foundation contract](../002-foundation-and-contracts/spec.md) defines shared payloads, limits, and lifecycle semantics. Each feature owns the behavior above; contract changes must update dependent specs.

## Out of scope

Custom speech training, a general benchmarking platform, participant voice cloning, committing private recordings, or claiming quality beyond the small sample set.

## Readiness and execution prerequisites

Whisper model download/execution, five authorized audio samples, TTS account access, and Malayalam human review are execution prerequisites. Documentation can be verified independently, but live speech readiness requires measured runs.

Provider credentials, model execution, a human reviewer, and devices are execution inputs where applicable. Record their availability during implementation. The selected STT model is `openai/whisper-large-v3`; do not substitute another Whisper checkpoint without updating this specification and decision record.

## Glossary

Side: one participant, A or B. Confirmed text: the edited account accepted with consent. Private analysis: server-only analyst JSON. Shared result: mediator/verdict or generic safety output eligible only after both confirmations. Generation: the single orchestrated result run for one session. seq: a sentence-audio index within a generation.
