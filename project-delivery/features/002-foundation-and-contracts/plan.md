# Application foundation and shared contracts: implementation plan

Status: draft plan based on the [draft spec](spec.md). Prepared at the user's request alongside the spec; it is not evidence of spec approval or completed implementation.
Owner: Frontend developer with backend contract review.
Input research: [brainstorm](../../brainstorms/002-foundation-and-contracts/brainstorm.md), [brainstorm sprint](../../brainstorms/002-foundation-and-contracts/sprint.md), [architecture](../../../zoomout_architecture.md), and inspected repository contents. No reusable app code or existing package scripts were found.

## Design and boundaries

Owns the wire/schema definitions and local scaffold. Feature 003 implements session semantics; 004-007 implement consumers. Protocol additions below supplement architecture section 7 explicitly.

Use npm workspaces, strict TypeScript, Next.js/Tailwind in app/frontend, Node WebSocket gateway in app/api, and runtime schemas in packages/contracts. Use a single gateway process with an in-memory store. Local ports: frontend 3000 and gateway 8787. Pin compatible versions at scaffold time rather than embedding unverified versions here.

Dependencies: None; 001 and 002 may begin in parallel.

Critical path: No upstream feature -> P1 -> P2 -> P3.

Riskiest work: Define schemas and fixtures. Mitigate with the phase-specific failure checks below before live integration. Project constraints are the three-screen flow, private side analysis, both-consent gate, bounded raw audio, provider adapters, and session-only state.

## Phases

### P1: Scaffold local services

Goal: scaffold local services and satisfy FR-002-01, FR-002-07.
Risk: Medium.
Prerequisites: The upstream contracts/evidence named above; fake providers may unblock interface work.

Files to create/modify (proposed): `package.json`, `app/frontend/`, `app/api/`, `packages/contracts/`, `.env.example`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Create the workspaces and select/pin compatible dependency versions.
2. Add explicit mock/live config, server-only provider settings, ports, and origin validation.
3. Add real lint/typecheck/test/build scripts and a minimal health/smoke route.

Verification: Install and run documented mock startup plus lint, typecheck, unit, and build scripts; inspect frontend module boundaries.
Acceptance IDs: AC-002-01, AC-002-07. Also exercise all related edge cases in spec.md.

Avoid: Do not copy unrelated legacy Worker/Vite database conventions or expose secrets through public environment prefixes.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P2: Define schemas and fixtures

Goal: define schemas and fixtures and satisfy FR-002-02, FR-002-03, FR-002-04, FR-002-06.
Risk: High.
Prerequisites: P1 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `packages/contracts/src/`, `tests/fixtures/events/`, `docs/event-contract.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Implement envelopes, bootstrap/join/snapshot contracts, and runtime schema validation.
2. Encode analyst/mediator/safety models, bounds, and public/private projections.
3. Add recording, seq/manifest, terminal outcome, and replay fixtures.

Verification: Validate good/bad fixtures for every event direction, privacy projection, score range, audio gap, and completion.
Acceptance IDs: AC-002-02, AC-002-03, AC-002-04, AC-002-06. Also exercise all related edge cases in spec.md.

Avoid: Do not independently duplicate browser/server types or overload audio_chunk with undocumented encodings.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

### P3: Provide fakes and documentation

Goal: provide fakes and documentation and satisfy FR-002-05, FR-002-08.
Risk: Medium.
Prerequisites: P2 verification passed, plus the upstream interface used by this phase.

Files to create/modify (proposed): `app/api/src/providers/`, `tests/fixtures/providers/`, `docs/local-development.md`. A bare report filename is relative to this feature directory; source/test paths are relative to repository root.

Steps:
1. Define cancellable provider interfaces and deterministic fake schedules/errors.
2. Connect a minimal browser-to-gateway smoke exchange.
3. Publish startup and contract documentation with links to downstream feature specs.

Verification: Exercise fake partial transcripts, invalid JSON, reversed completion, timeout, and cancellation; have both developers follow the setup guide.
Acceptance IDs: AC-002-05, AC-002-08. Also exercise all related edge cases in spec.md.

Avoid: Do not mistake a fake-provider smoke pass for live provider verification.

Exit: record commands or manual evidence and outcomes in implementation-notes.md, then update status.md. If evidence is missing, keep the phase pending/blocked; never infer a pass from a written plan.

## Requirement traceability

| Requirement | Acceptance | Phase | Current evidence |
| --- | --- | --- | --- |
| FR-002-01 | AC-002-01 | P1 | Passed: npm workspaces scaffolded, mock startup works without keys, live credential validation verified via tests |
| FR-002-02 | AC-002-02 | P2 | Passed: Versioned envelope and direction enforcement tested in `contracts.test.ts` and `fixtures.test.ts` |
| FR-002-03 | AC-002-03 | P2 | Passed: Bootstrap room create, B claim, 409 conflict, and snapshot schemas verified |
| FR-002-04 | AC-002-04 | P2 | Passed: Analyst/Mediator bounds, petty_score 0-10, requires_apology: false, and snapshot privacy verified |
| FR-002-05 | AC-002-05 | P3 | Passed: Cancellable fake providers for STT, Analyst, Mediator, Judge, and TTS tested in `fakeProviders.test.ts` |
| FR-002-06 | AC-002-06 | P2 | Passed: Audio manifests (success, gap, all-failed) and outcome contracts verified |
| FR-002-07 | AC-002-07 | P1 | Passed: `build`, `typecheck`, `test`, `test:e2e` scripts implemented; browser origin validation enforced |
| FR-002-08 | AC-002-08 | P3 | Passed: Published `docs/local-development.md` and `docs/event-contract.md` with full flow, ports, and schema docs |

## Verification execution

Feature 002 must first create actual scripts for lint, typecheck, unit tests, build, and targeted E2E. At execution time, inspect the manifests and record exact commands/results rather than borrowing unrelated .agents legacy commands. For this documentation task only artifact structure, links, requirement coverage, and plan consistency are checked. Live provider/device evidence is a separate gate.

This plan adds explicit protocol details absent from the architecture. Keep the shared schema package authoritative. Runtime/dependency compatibility will be verified when scaffolding is implemented.

## Recovery and handoff

Read status.md first when resuming, then the current spec, plan, decisions, and implementation notes. Implement phases in order unless a documented dependency justifies mock work in parallel. Keep each phase usable with deterministic fixtures, and record any changed decision before updating dependent contracts. All work remains pending until implementation is requested.

On completion, hand off the behavior described in spec.md and its acceptance evidence, then rerun /review-task 002-foundation-and-contracts. See [audit.md](audit.md) for the current document review, not a runtime compliance sign-off.
