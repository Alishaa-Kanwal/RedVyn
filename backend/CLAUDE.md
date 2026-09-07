# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RedVyn coordinates blood donors for thalassemia patients (scheduled, ~21-day cycle) and
emergencies (trauma, PPH). It is **not** a blood bank — no screening, testing, storage or
transport. It gets an eligible donor to the right desk at the right time and proves identity
via a donation code.

`redvyn-workflow.md` is the spec and the source of truth. Code comments cite it by section
(`§3.3`, `§5.1`). **Read the cited section before changing code that references it** — the
comments explain *why*, the spec explains *what else depends on it*.

## Layout

The repo is two siblings: `backend/` holds the entire Node project (package.json,
node_modules, prisma, views), and `frontend/` is currently empty. There is no package.json
at the repo root — **every command below runs from `backend/`**.

## Commands

```bash
npm run dev          # tsx watch src/server.ts
npm run typecheck    # tsc --noEmit — run this, there is no linter
npm test             # node --test over test/*.test.ts
npm run build        # tsc -> dist/
npm start            # node dist/src/server.js

npm run generate     # prisma generate -> src/generated/prisma (gitignored)
npm run migrate      # prisma migrate dev
npm run seed         # tsx prisma/seed.ts
```

Single test: `node --import tsx --test test/<name>.test.ts`
Single case: append `--test-name-pattern "<pattern>"`

Tests run against `DATABASE_URL` — there is no separate test database. The suite never
truncates: every row it creates is tagged with a per-run marker and deleted in `after`,
and its fixtures sit at 25.4N 68.3E so they cannot compete with seeded Lahore donors for
lineup slots. Keep both properties when adding tests.

## Prisma 7 — differs from every Prisma 6 tutorial

- Config lives in `backend/prisma.config.ts`, not the `prisma` key in package.json. It does **not**
  auto-load `.env`; the `import "dotenv/config"` on line 1 is load-bearing.
- `datasource db` in the schema has no `url`. It comes from the config (CLI/migrations) and
  from the driver adapter (runtime).
- Generator is `prisma-client` (not `prisma-client-js`), emitting **TypeScript into
  `src/generated/prisma/`**. Generated, gitignored, never edit. Import enums from
  `../generated/prisma/enums`, the client from `../generated/prisma/client`.
- Rust-free: no query engine binary. `new PrismaClient()` bare throws — it needs an adapter.
  [src/db.ts](backend/src/db.ts) is the single place that builds it; import `prisma` from there.
- **Prisma promises are lazy.** `void prisma.x.create(...)` never executes — no error, no
  row. Fire-and-forget silently drops writes. Always await. This already ate the audit log
  once; `backend/test/redvyn.test.ts` has a guard for it.

TypeScript 7 also removed `moduleResolution: "node"`, so tsconfig is on `nodenext` (still
emitting CommonJS, because package.json says `"type": "commonjs"`).

## Layers

Request flow is strictly one direction — **routes → controllers → services** — with
middleware wrapping the edge:

| Layer | Holds | Never |
| --- | --- | --- |
| [src/routes/](backend/src/routes/) | URL → handler binding, middleware order | logic, DB access |
| [src/middleware/](backend/src/middleware/) | auth gate, zod validation, error rendering | domain rules |
| [src/controllers/](backend/src/controllers/) | req/res, zod schemas, `res.render` | invariants, raw SQL |
| [src/services/](backend/src/services/) | all domain logic, all Prisma calls, all invariants | `req`, `res` |

Services never import from express. A controller that reaches past its service into
`prisma` is the smell to watch for — [public.controller.ts](backend/src/controllers/public.controller.ts)
reads offers directly for the render, and that is the one deliberate exception.

## Invariants — breaking these is a correctness bug, not a style issue

**No LLM decides anything.** Matching, allocation, escalation, eligibility, scoring and
prediction are SQL and arithmetic. The model converts speech to one of a few structured
intents and reads facts back. A keypress, never model inference, commits a state change.

**Donor payloads cannot contain patient identity.** Enforced by type, not review: the
function building a donor-facing payload takes an input type with no patient fields. Standby
payloads additionally have no hospital and no code field, so a misconfigured template cannot
leak them. The donation code is the only join key between donor and family.

**Slot allocation is a guarded UPDATE, never read-modify-write.** Decrement
`Case.slotsRemaining` in SQL with a `WHERE slotsRemaining > 0` guard. Reading then writing
recruits 8 donors for 4 units under concurrent acceptance.

**Phones never touch the wire in plaintext.** `phoneHash` (HMAC, the lookup index) and
`phoneEnc` (AES-256-GCM). `decryptPhone()` is the only way back, and §4.1 requires access be
logged — route callers through `services/phone.ts:revealPhone()`, which writes the `Event`
row. Do not call `decryptPhone` from a route.

**An offer must outlive its `neededAt`.** `expiresAt` is `neededAt + 12h`, set in
`createCase`, never equal to `neededAt` — `window` is free text ("10:00-13:00") so the real
end of the donation window cannot be computed. Setting the two equal makes every emergency
expire the instant it is created. `createCase` also refuses a `neededAt` already past the
grace, because a lineup that can never be accepted still locks its donors out of other cases.

**`Event` is append-only and carries ids only, never PII.** It is both the audit log (§5.5)
and the stand-in for the message bus (§4.1).

**State transitions are guarded and loud.** `filled` requires `unitsSecured >= unitsRequired`;
`confirmed` requires a `Donation` row created by the requester side (a donor confirming their
own donation would farm reliability score). Illegal transitions raise — never silently ignore,
a silent state bug means someone does not get blood.

## Deliberate deviations from the spec

Both are documented at the top of `backend/prisma/schema.prisma`:

- **Floats, not PostGIS.** Distance is an inline haversine in the match query, mirrored by
  `haversineMeters()` in `src/lib/blood.ts`. The two must agree; a test asserts it. PostGIS
  would force `Unsupported("geography")` and push every donor insert into raw SQL.
- **No Redis.** Slot allocation is the conditional UPDATE above — atomic and durable, so
  there is no counter to rebuild after a crash. The scheduler will need the sweeper cron
  (§3.5) regardless.

Blood compatibility (`src/lib/blood.ts`) is a lookup table used as a **filter**; exact-group
match is only a ranking weight, so the system degrades to compatible rather than finding
nobody.

## Current state

Build-order steps 1–4 are done and working end to end: registries + ops console, matching and
case creation, link-based outreach, codes and family confirmation. `npm run seed` puts 8
Lahore donors, 2 hospitals and 1 thalassemia patient in place.

Three surfaces, all server-rendered EJS from [views/](backend/views/):

- `/ops/*` — console behind a single shared password (§v1). Registries, match preview, case
  creation, lineup, manual promote, audited phone reveal.
- `/offer/:token` — the donor page. Standby and primary render from different payload types.
- `/case/:token` — the family page. Holds the code and the only confirm button.

A scheduled primary who **declines** auto-promotes the next standby (§3.10 rewards early
declines precisely because they buy time to re-fill). The offer token never changes on
promotion, so the standby's existing link simply starts rendering the primary view. A
*timeout* still needs the manual Promote button — that is the scheduler's job, not built yet.
When a decline exhausts the lineup, `case.lineup_exhausted` lands in the audit log.

**Not built yet**, in build order: the escalation scheduler and sweeper (§3.5 — `promoteStandby`
is the manual stand-in for timeouts), voice and DTMF (§5.3), WhatsApp templates (§4.2 — ops copies offer
links by hand today), Qwen dialogue (§6.2), prediction and reliability scoring beyond the
flat +5 on confirmation (§3.2, §3.10), radius expansion and blood-bank fallback (§3.7).

Unreachable-by-design today: the `escalating`, `broadcasting`, `fallback_bloodbank` and
`unfilled` case states exist in the enum for §5.1 completeness but nothing transitions into
them until the scheduler lands.
