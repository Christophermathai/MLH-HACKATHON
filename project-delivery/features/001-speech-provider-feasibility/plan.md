# Speech provider feasibility: implementation plan

Status: approved for implementation with user-directed Whisper Large v3 STT.
Owner: Backend developer; Malayalam-speaking reviewer.
Input research: [brainstorm](../../brainstorms/001-speech-provider-feasibility/brainstorm.md), [brainstorm sprint](../../brainstorms/001-speech-provider-feasibility/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns provider evidence and selection. Feature 002 owns application contracts; 004 and 007 own production adapters.

Use five synthetic or explicitly consented samples. Validate `openai/whisper-large-v3` locally in batch mode through Transformers with a documented device, dtype, language, task, and chunking configuration. Compare the proposed ElevenLabs voice with Google TTS fallback. Cap the spike at one hour and publish a partial report if model execution, TTS access, samples, or human review are unavailable.

Dependencies: None; 001 and 002 may begin in parallel.

Critical path: No upstream feature -> P1 -> P2 -> P3.

Riskiest work: Run comparison and decide. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Prepare evidence inputs

Goal: prepare evidence inputs and satisfy FR-001-01, FR-001-02.
Risk: Medium.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `scripts/provider-spike/`, `tests/fixtures/speech/`, `provider-results.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Prepare the manifest and normalization/scoring rules.
2. Read current official Whisper Large v3/Transformers and TTS provider documentation; inspect local runtime/account access before any paid test.
3. Record the exact Whisper checkpoint and execution settings plus TTS candidate configurations and blocked access without exposing secrets.

Verification: Inspect five manifests and documentation/account evidence; run the harness against a fake provider before live calls.
Acceptance IDs: AC-001-01, AC-001-02. Also exercise all related edge cases in spec.md.

Avoid: Do not infer access from marketing language or publish private sample audio.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Run validation and decide

Goal: run Whisper validation and TTS comparison, then decide readiness for FR-001-03, FR-001-04, FR-001-05, FR-001-06.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `scripts/provider-spike/`, `provider-results.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Run Whisper Large v3 on all five samples and record word edits, timings, and meaning judgments.
2. Render tagged/untagged TTS samples and the candidate fallback.
3. Apply the Whisper approval gate and publish exact identifiers, encodings, execution settings, and limitations.

Verification: Review raw measurements and the decision rule with a Malayalam speaker; separate missing measurements from failures.
Acceptance IDs: AC-001-03, AC-001-04, AC-001-05, AC-001-06. Also exercise all related edge cases in spec.md.

Avoid: Do not select by latency alone or claim a provider was tested when only its documentation was read.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Clean up and hand off

Goal: clean up and hand off and satisfy FR-001-07, FR-001-08.
Risk: Medium.
Prerequisites: P2 attempted, blocked, or the one-hour checkpoint reached. Cleanup and a partial report are mandatory even when comparison checks do not pass.

Files to create/modify (proposed): `provider-results.md`, `sample-manifest.json`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Remove private sample audio and document permitted retained artifacts.
2. Publish results or a partial/blocked report at the checkpoint.
3. Give 004/007 selected configurations and the list of unresolved live prerequisites.

Verification: Inspect retained files and report fields; verify no blocked candidate is presented as live-ready.
Acceptance IDs: AC-001-07, AC-001-08. Also exercise all related edge cases in spec.md.

Avoid: Do not hide unmet checks when the time box ends.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-001-01 | AC-001-01 | P1 | Partial: five scenarios/reference texts exist; actual audio durations blocked |
| FR-001-02 | AC-001-02 | P1 | Partial: official docs and local runtime recorded; model/account execution blocked |
| FR-001-03 | AC-001-03 | P2 | Not implemented / not run |
| FR-001-04 | AC-001-04 | P2 | Not implemented / not run |
| FR-001-05 | AC-001-05 | P2 | Not implemented / not run |
| FR-001-06 | AC-001-06 | P2 | Partial provider report published; live selections blocked |
| FR-001-07 | AC-001-07 | P3 | Ignore/retention policy verified; no private audio was present to delete |
| FR-001-08 | AC-001-08 | P3 | Partial/blocked state and typed/mock handoff published |

## Verification execution

The standalone provider spike may run independently of feature 002; document its exact harness command and local prerequisites when created. Application checks become available when 002 creates actual scripts. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

Live account access and Malayalam human review are execution prerequisites. No provider capability, price, or account quota was checked in this documentation task.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 001-speech-provider-feasibility. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
