# Session gateway, participant isolation, and recovery: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Use the shared contract's create/claim/join flow, 30-minute absolute session lifetime, and per-side opaque resume token. One active socket per side; successful authenticated reconnect replaces the old socket. Server restart loses in-memory sessions and requires a new room.

Ownership boundary: Owns side binding, state transitions, event routing, lifecycle, and resume. 005 owns consent UX; 006 owns the analysis pipeline; 007 owns audio manifests and cache contents.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/003-session-gateway-and-recovery/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-02, D-03, D-04, D-05, D-12 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

The in-memory design cannot recover after process restart. Exactly-once orchestration is scoped to one live process/session; it does not guarantee provider-side billing exactly once after network uncertainty.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
