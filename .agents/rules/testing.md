# Testing Conventions (legacy reference)

For ZoomOut work, use `.agents/rules/zoomout-architecture.md`. The venue,
tenant, Durable Object, and migration checks below do not apply.

## Running checks

### Backend (`app/api`)

```bash
npm run check         # typecheck + check:tenancy + check:do + test
```

That is the gate. What it runs, and why each one exists:

| Step | Catches |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, strict with `noUncheckedIndexedAccess` |
| `npm run check:tenancy` | a raw connection outside `src/db`, or a cross-tenant read with no justification comment |
| `npm run check:do` | `fetch`, `createDb`, Drizzle or a network binding under `src/do` |
| `npm run test` | vitest on `@cloudflare/vitest-pool-workers` |

The two `check:*` steps are not style rules. They enforce the invariants the
type system cannot, and both failure modes are silent in production: a query
that reaches another tenant's rows, and an awaited round trip inside a Durable
Object that serialises every other request for that venue.

`npm run lint` (eslint) is separate and not part of `check`.

### Frontend (`app/frontend`)

```bash
npm run lint          # eslint, then check:colors
npm run type-check    # tsc --noEmit
npm run test          # vitest
```

`npm run check:colors` fails on a hex, `rgb()`, `oklch()` or Tailwind default
palette class anywhere outside `src/styles/tokens.css`, against a baseline that
may only shrink. There is no Prettier in this repo, so there is no
`format:check`.

## Pre-commit checklist

1. `cd app/api && npm run check`
2. `cd app/frontend && npm run lint && npm run type-check && npm run test`
3. If the schema changed: regenerate with `npm run db:generate`, and confirm
   `npm run db:reset` still completes against a local database. Custom SQL that
   Drizzle cannot express belongs in `migrations/custom/`, in the order
   `scripts/migrate.mjs` applies.
4. No em dashes, in code, comments or the commit message.

## Local database for tests

```bash
npm run dev:db        # docker, postgis + pgvector, :5432
npm run db:migrate
npm run db:seed
```

`npm run db:reset` does all three from empty and refuses any host that is not
localhost. Native Postgres works too, provided all six extensions are
available: `pgcrypto`, `vector`, `pg_trgm`, `fuzzystrmatch`, `postgis`,
`btree_gist`.

## The parked backend

`app/_old/backend` is the retired FastAPI service. Its ruff and Alembic
commands are not part of any gate here. Do not add tests to it.
