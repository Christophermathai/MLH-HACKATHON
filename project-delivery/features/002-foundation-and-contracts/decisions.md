# Application foundation and shared contracts: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Use npm workspaces, strict TypeScript, Next.js/Tailwind in app/frontend, Node WebSocket gateway in app/api, and runtime schemas in packages/contracts. Use a single gateway process with an in-memory store. Local ports: frontend 3000 and gateway 8787. Pin compatible versions at scaffold time rather than embedding unverified versions here.

Ownership boundary: Owns the wire/schema definitions and local scaffold. Feature 003 implements session semantics; 004-007 implement consumers. Protocol additions below supplement architecture section 7 explicitly.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/002-foundation-and-contracts/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-01, D-03, D-07, D-11, D-16 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

This plan adds explicit protocol details absent from the architecture. Keep the shared schema package authoritative. Runtime/dependency compatibility will be verified when scaffolding is implemented.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
