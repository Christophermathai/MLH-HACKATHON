# Application foundation and shared contracts: implementation notes

## Current evidence

- Documentation prepared on 2026-10-25.
- Application changes: none.
- Provider calls and deployments: none.
- Runtime tests/builds: not run; application source and package manifests do not exist.
- Document checks and readiness findings: see [audit.md](audit.md).

## Inputs needed before live execution

This plan adds explicit protocol details absent from the architecture. Keep the shared schema package authoritative. Runtime/dependency compatibility will be verified when scaffolding is implemented.

## Execution record

### 2026-10-25: Phase 1 (Scaffold local services)
- Files created/modified:
  - `package.json`: Root workspaces configuration (`packages/*`, `app/*`), monorepo scripts (`build`, `typecheck`, `lint`, `test`, `test:e2e`, `dev`).
  - `.env.example`: Root, gateway (`app/api/.env.example`), and frontend (`app/frontend/.env.example`) environment templates.
  - `.gitignore`: Ignore `node_modules`, `dist`, `.next`, build artifacts, and secret env files while allowing `.env.example`.
  - `packages/contracts/`: Scaffolded package `@zoomout/contracts` with `package.json`, `tsconfig.json`, and initial entry point.
  - `app/api/`: Scaffolded package `@zoomout/api` with `package.json`, `tsconfig.json`, `src/config.ts`, `src/server.ts`, `src/index.ts`, `src/config.test.ts`, `src/server.test.ts`, `src/smoke.test.ts`.
  - `app/frontend/package.json`: Updated name to `@zoomout/frontend`, linked dependency `@zoomout/contracts`.
  - `scripts/dev.js`: Local multi-service runner.
- Requirements and Acceptance criteria:
  - FR-002-01 / AC-002-01: Documented workspaces with mock/live mode. In mock mode, server starts without external credentials; in live mode, missing credentials throw clear startup error (`Missing required live configuration: OPENAI_API_KEY, ELEVENLABS_API_KEY. Set these variables or run with PROVIDER_MODE=mock.`).
  - FR-002-07 / AC-002-07: Manifest scripts created across all workspaces (`build`, `typecheck`, `test`, `test:e2e`). Allowed browser origins validated on HTTP and WebSocket upgrade. Frontend bundle contains no provider secrets or server modules.
- Verification checks:
  - `npm run build`: contracts, api, and frontend compiled successfully.
  - `npm run typecheck`: clean across all workspaces.
  - `npm run test`: passed (6/6 tests passing in api: config defaults, live credential check, origin validation, WebSocket ping/pong, origin rejection).
  - `npm run test:e2e`: passed (smoke test verifying health endpoint).
- Deviations: None.
- Remaining work: P2 (Define schemas and fixtures), P3 (Provide fakes and documentation).

## Resume pointer

Read [status.md](status.md) and start with its next action. Proposed source paths in plan.md are not existing files. Preserve unrelated working-tree changes when implementation begins.
