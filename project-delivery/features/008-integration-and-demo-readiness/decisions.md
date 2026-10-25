# Integration, failure recovery, and demo readiness: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Use two isolated browser contexts for automated flows and the actual chosen demo devices for manual audio checks. Local loopback is the baseline run environment; any remote microphone demo needs a secure origin and WebSocket-capable single gateway deployment. Record exact browser/runtime/device versions when executed. The six-hour schedule is a target, not evidence of completion.

Ownership boundary: Owns end-to-end evidence and rehearsal. Earlier features own fixes to their behavior; this feature does not defer privacy or cleanup implementation until release time.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/008-integration-and-demo-readiness/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-06, D-14, D-15 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Provider credentials, human review, demo devices, and any remote host are execution prerequisites. Integration scope may exceed six hours; publish unfinished checks explicitly.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
