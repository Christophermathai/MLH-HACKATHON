# Analysis, mediation, judge text, and safety: implementation notes

- Created prompts in `app/api/src/agents/prompts.ts`:
  - `ANALYST_SYSTEM_PROMPT`: Private per-side analysis with safety check for abuse/coercion.
  - `MEDIATOR_SYSTEM_PROMPT`: Balanced shared mediation, petty_score (0-10), zoom-out, and truce with `requires_apology: false`.
  - `JUDGE_SYSTEM_PROMPT`: Spoken Malayalam verdict in 4 structured sections (dramatic opening, situation ruling, gentle zoom-out, practical sentence) under 1200 chars.
- Implemented `OpenAiLlmProvider` (`app/api/src/providers/openaiLlm.ts`):
  - Strips markdown code fences.
  - Validates against `AnalystSchema` and `MediatorSchema`.
  - Retries invalid JSON once before failing.
- Implemented Orchestrator Pipeline (`app/api/src/sessions/orchestrator.ts`):
  - Runs Analyst for Side A and Side B concurrently.
  - Deterministic safety branch: if abuse or coercion is detected on either side, immediately resolves with calm non-accusatory safety text and bypasses Mediator, Judge, and TTS completely.
  - Verified with comprehensive test in `app/api/src/sessions/orchestrator.test.ts`.
