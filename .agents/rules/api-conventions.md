# ZoomOut WebSocket and API Conventions (legacy reference)

The architecture source of truth is `zoomout_architecture.md`. The rules below
The old venue-application conventions below do not apply. Use the ZoomOut
WebSocket rules in `.agents/rules/zoomout-architecture.md` instead.

Applies to `app/api`. `app/_old/backend` is the parked FastAPI service: read it
for reference, never add to it.

## General

- Every endpoint lives under `/api`, served by one Worker that also serves the
  SPA. Health is `/api/health`, not `/health`: `/health` falls through to the
  SPA, because `run_worker_first` in `wrangler.jsonc` only claims `/api/*`.
- RESTful resource naming. Feature branches off `main`.
- Venue-scoped resources mount under `/api/venues/:venueId`. Anything above the
  tenant line is `/api/platform/*` and is authorised by a `platform_admins` row,
  never by a venue role.

## Backend patterns

- Hono sub-apps per resource, mounted in `src/routes/index.ts`. Handlers stay
  thin: no business logic, no SQL.
- Zod for request and response validation, via `@hono/zod-validator`. The
  schemas live in `src/shared/schemas/` and the frontend imports the same files
  through the `@contract` alias, so the contract has one definition, not two.
- Drizzle over `postgres` through the `HYPERDRIVE` binding. All queries go
  through `TenantDb`; read `src/db/tenant.ts` before writing one.
- Migrations are `migrations/0000_baseline.sql` plus ordered files in
  `migrations/custom/`, applied by `scripts/migrate.mjs`. There is no Alembic.
- Throw the helpers in `@/lib/errors` (`badRequest`, `notFound`, `conflict`,
  `forbidden`, ...), never a bare `Error`. `onError` turns an `ApiError` into
  the response body; anything else becomes a 500 with no detail.

## Middleware order

Set in `src/index.ts` and `src/routes/index.ts`. Order is load-bearing:

```
requestId → securityHeaders → (CORS, development only)
  → requireValidConfig → rejectUnsafePaths → limitBody → requestDeadline
  → requireAuth (WorkOS JWT)      [skipped on health and Vapi routes]
  → requireVenue (grants TenantDb) [venue-scoped routes only]
  → requireCan('write' | 'admin')  [mutations]
  → handler → domain → db / Durable Object / Queue / Workflow
```

## Frontend-backend contract

- One origin in uat and production: the same Worker serves `ASSETS` and `/api`,
  so the session cookie is first-party and there is no CORS.
- Locally that is reproduced by a proxy, not by a second origin. Vite runs on
  `http://localhost:3737` and proxies `/api` to `wrangler dev` on
  `http://localhost:8787`. Work on 3737.
- Do not point `VITE_API_BASE_URL` at `:8787`. The Worker's dev CORS block will
  allow the request and the session cookie will still not be sent, because it is
  `SameSite=Lax` and that is a cross-origin XHR. Leave the variable empty so
  `API_BASE_URL` falls back to `/`.
- Auth is a WorkOS JWT in an httpOnly cookie, verified at the Worker against
  published JWKS. `redirect_uri` is derived from the inbound Host, so the Vite
  proxy keeps `changeOrigin: false` and `http://localhost:3737/api/auth/callback`
  has to be registered in WorkOS.

## Domain model

Sector is a column, not four parallel table families. `venues` is the tenant
table.

1. **Venue** — the tenant. Sector: restaurant, hotel, salon, clinic.
2. **Offering** — menu item, salon service, hotel room type, clinic treatment.
3. **Resource** — table, stylist, room, consulting room.
4. **Reservation** — booking, appointment, stay.
5. **Order** — an order and its lines, for the sectors that take them.

Sector-specific fields live in typed JSONB, not in extra tables.
