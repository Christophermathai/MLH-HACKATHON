# Analysis, mediation, judge text, and safety: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Use an environment-configured structured-JSON-capable LLM behind adapters; specific model access is validated during implementation. Default verdict language is Malayalam, allowing natural familiar English terms for mixed input. petty_score is 0-10, requires_apology is false. Target 400-800 visible Unicode characters; enforce a 1200-character hard cap and 60-second per-stage deadline. A request failure is not retried automatically; invalid structured JSON gets one validation retry.

Ownership boundary: Owns prompts, schema validation, stage retries, deterministic safety routing, and judge text. 003 owns generation ownership/routing; 007 owns synthesis/playback.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/006-analysis-mediation-and-safety/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-05, D-08, D-09, D-13 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Prompt adherence and safety detection remain probabilistic. Model access and a Malayalam human reviewer are prerequisites for live quality sign-off; no model has been selected or tested in this documentation task.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
