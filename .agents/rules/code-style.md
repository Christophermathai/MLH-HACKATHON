# Code Style Rules (legacy reference)

For ZoomOut work, use `.agents/rules/zoomout-architecture.md` and the ZoomOut
context. The venue, tenant, WorkOS, Drizzle, and parked-backend conventions in
this legacy file do not apply.

Both halves of the live tree are TypeScript. `app/_old/backend` is the parked
Python service: reference only, no new code, and its conventions do not apply
to anything here.

## TypeScript (`app/api` and `app/frontend`)

- **Strict**, with `noUncheckedIndexedAccess`. Array access returns
  `T | undefined`; narrow it rather than asserting it away.
- **Components** PascalCase. **Functions and variables** camelCase.
- **Line length** 100 characters.
- **Import alias** `@/`. The frontend also has `@contract`, `@contract/platform`
  and `@contract/playground`, which resolve into `app/api/src/shared/schemas`.
  The request and response shapes have one definition, in the Worker, and the
  frontend imports it. `src/types/api.ts` re-exports that contract so no page
  has to know where it physically lives; nothing in it is hand written. Never
  restate a server shape as a local interface.
- **Errors**: throw the helpers in `@/lib/errors` (`badRequest`, `notFound`,
  `conflict`, `forbidden`, `unauthenticated`, ...), never a bare `Error`. Only
  an `ApiError` reaches the caller with its message intact; anything else is
  logged and answered as `internal`.
- **Quoting**: `app/api` is single quotes, no semicolons, trailing commas.
  `app/frontend` is predominantly double quotes with semicolons. Neither is
  enforced: there is no Prettier and no stylistic ESLint rule in either
  package. Match the file you are editing rather than reformatting it.

## Comments

Explain **why**, not what. Every non-obvious file opens with a block comment
saying what it is for and what decision it embodies. `src/db/tenant.ts` and
`src/do/VenueCoordinator.ts` are the reference register.

No em dashes anywhere, including comments and commit messages. Use a colon, a
comma, or restructure.

## Database values

- **`numeric` columns arrive as strings. Keep them strings.** Drizzle's
  `numeric` has no `mode: 'number'` here on purpose. Money must not round-trip
  through a float.
- **`fetch_types: false`** on the Postgres client, so custom types also arrive
  as strings. That saves a catalogue round trip on every cold Worker.
- Every query goes through `TenantDb`. Read `app/api/src/db/tenant.ts` before
  writing one. The only two escapes are `tdb.raw`, which must carry a
  `Tenant-scoped raw statement:` comment naming the predicate that carries the
  scope, and `createDb`, which must carry an `@non-tenant-context <reason>`
  line. `npm run check:tenancy` fails the build on either one missing.

## Datetimes

- **`timestamptz` everywhere.** The schema has no naive timestamp column, and
  new ones use `timestamp({ withTimezone: true })`.
- Drizzle hands these back as `Date`. Serialise with `.toISOString()`; never
  hand-format one, and never store a local wall-clock string.
- A venue's own opening hours are the exception that is *not* a timestamp: they
  are a local time plus the venue's IANA timezone, because 9am means 9am in the
  venue's city whatever the offset is that week.
- The naive-UTC rule from the old asyncpg stack is retired. `datetime.utcnow()`
  applied to `app/_old` and nothing else.

## Frontend structure

`app/frontend/src/`:

- `pages/` — one directory per route
- `features/` — feature-owned hooks and logic (`calls`, `menu`, `onboarding`,
  `playground`, `team`, `delivery-zones`, `operating-hours`)
- `components/` — `layout/`, `common/`, and feature-named groups
- `api/` — axios client, one module per resource
- `contexts/`, `hooks/`, `utils/`, `styles/`, `types/`

There is no `src/ui/`, no shadcn/ui, and no Phaser in this repo.

## Shared components

- `@/components/layout/Layout` — app shell. Every operator screen wraps in it,
  then `<TopBar subtitle title action />`, then content padded `32px 40px 96px`.
- `@/components/layout/TopBar` — eyebrow, Fraunces display heading, actions.
- `@/components/layout/Sidebar` — venue name at the top, which is also the
  venue switcher when there is more than one, then nav, then the signed-in
  account at the foot.
- `@/components/common/Icon` — Heroicons plus a `spark` star that takes
  `--sparkle`. Never inline SVG for a new icon.
- `@/components/common/Logo` — the robot mark and wordmark, `light` (default)
  and `dark`. The mark is the only logo asset.

## Colour

Every colour value in the frontend is written in `src/styles/tokens.css` and
nowhere else. Use role tokens in components, never the palette hue names:
`--brand`, `--highlight`, `--bg-*`, `--fg-1..4`, `--border-*`, and the status
set. `--accent` (amber) is reserved for premium moments and never appears on a
destructive or error path.

Translucency is `color-mix(in oklab, var(--token) N%, transparent)`, never a
second literal. Code that cannot read a CSS variable, such as canvas or
Leaflet, resolves tokens through `@/utils/tokenColor`.

`npm run check:colors` enforces this, and still flags the deleted pre-logo
names (`--terracotta-*`, `--brass-*`, `--sand-400`, `--clay-500`, `.btn-brass`,
`.badge.brass`) so older docs cannot reintroduce them.

See the design system section of `CLAUDE.md` for typography, primitives and
voice.
