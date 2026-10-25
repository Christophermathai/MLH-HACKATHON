# Analysis, mediation, judge text, and safety

Status: brainstorm proposal; implementation has not started.
Complexity: needs brainstorming. Relative effort: L. Main risk: High.
Suggested owner: Backend developer.

## Problem and research

Turn two accounts into a balanced, useful perspective while preventing unsupported interpretations and inappropriate playful treatment.

The architecture specifies two private analyst JSONs, one mediator JSON, and a plain-text judge stream. Analysts receive confirmed text only. Safety flags must bypass playful judgment; malformed JSON may be retried once after code-fence cleanup.

Sources: [architecture](../../../zoomout_architecture.md), Sections 5, 8, and 9; [project context](../../../.agents/project-context.md). Repository inspection found documentation and agent guidance only, with no application code or reusable implementation.

## Scope

- Implement validated analyst and mediator outputs and a short streamed judge response.
- Distinguish stated claims, assumptions, uncertain lines, and possible feelings.
- Use a deterministic safety branch that suppresses playful judgment if either analysis flags concern.
- Treat transcript content as data, cap retries, and surface calm errors when validation or providers fail.

Excluded: No determination of who is objectively right, clinical diagnosis, forced apologies, or therapy claims.

## Approaches

| Approach | How it works | Benefits | Tradeoffs | Risk | Effort |
| --- | --- | --- | --- | --- | --- |
| Separate analyst, mediator, and judge calls (recommended) | Follow the architecture with validation and orchestration between stages. | Clear privacy boundaries and testable safety decisions. | More calls and latency. | Medium | L |
| Single combined prompt | Send both transcripts in one call after consent. | Fewer requests and simpler orchestration. | Loses separate private analysis and clear stage validation. | High | M |

## Recommended approach

Recommend the documented multi-stage pipeline, with analysts running independently after their own confirmation. Mediation waits for both consents and valid analyses. A safety result or failed safety evaluation must never silently fall through to playful generation.

The other approach is deferred for the tradeoffs above; this brainstorm is a recommendation, not an approved functional spec.

## Dependencies and handoff

Dependencies: 002 JSON schemas, 003 readiness gate, 005 confirmed transcript semantics. Fixtures allow independent prompt work.

Deliver to the next unit: Validated mediator output, judge text deltas, or a calm safety result with an agreed contract. Unit 007 consumes text; private analyst fields stay inside the gateway.

Likely files/systems: Proposed: app/api/src/agents/, app/api/src/prompts/, app/api/tests/agents/, tests/fixtures/conversations/.
These are proposed locations, not existing code.

## Completion checks for the future implementation

- No model call receives unconfirmed text or another side's data prematurely.
- Invalid JSON is retried once and then produces a controlled error.
- A flagged side bypasses playful judge output and coercive truce suggestions.
- Fixture cases cover ambiguous recognition, contradictory accounts, prompt-injection text, and ordinary disagreement.
- Spoken text uses the agreed language, short sentences, and situation-focused humor.

## Open decisions

- Which structured-output-capable LLM is available?
- What petty_score range, length cap, and verdict language should be used?
- How is a safety outcome represented without revealing sensitive private notes?

Resolve these during specification or the provider spike, before dependent implementation. The current task is decomposition; no external provider validation or API calls were performed.

## Delivery path

Standard: /spec-task -> /plan-task -> /implement-task -> /review-task.

Next step: `/spec-task analysis-mediation-and-safety`, using this brainstorm and [sprint breakdown](sprint.md).
