# RedVyn Backend — Build Roadmap & Qoder Handoff

**Purpose of this file:** attach this to Qoder alongside `redvyn-workflow.md` and `CLAUDE.md`
so it always has the full picture — what's built, what isn't, and the decisions already made
— before generating any new feature. `redvyn-workflow.md` is the *product spec*. This file is
the *build log and sequencing plan* layered on top of it. Update the "Current State" section
each time a phase ships.

Backend-first. Frontend (Next.js dashboard, per `redvyn-frontend-guide.md`) gets built
page-by-page right after the backend feature it depends on ships — noted per phase below.

---

## 0. How this file gets used

1. This whole file goes into Qoder's context (attach it in Qoder IDE).
2. One phase at a time gets built — not the whole roadmap in one shot. Credits are limited
   (2,490 total for the hackathon), so each phase is scoped to a single focused Qoder prompt.
3. After a phase ships: update §1 (Current State) and check off the phase in §4, then build
   its matching frontend pages before moving to the next backend phase.
4. Ask for "the Qoder prompt for Phase N" and you'll get a short, complete, copy-pasteable
   prompt scoped to exactly that phase — referencing this file's decisions so Qoder doesn't
   re-litigate them or invent conflicting patterns.

---

## 1. Current State (updated: Phase 5 in progress)

**Build-order steps 1–4 (from `redvyn-workflow.md` §9) are done and working end to end:**
registries + ops console, matching and case creation, link-based outreach, codes and family
confirmation. `npm run seed` puts 8 Lahore donors, 2 hospitals and 1 thalassemia patient in
place.

Three surfaces, all server-rendered EJS today:
- `/ops/*` — console gated by **a single shared password** (`ADMIN_PASSWORD` env var,
  `session.ops = true` boolean). No per-user accounts, no roles, no audit trail of *who* did
  an action, only *that* an ops action happened.
- `/offer/:token` — donor page (standby/primary payloads differ by type).
- `/case/:token` — family page, holds the code and the confirm button.

**Frontend:** only the Next.js marketing/landing site exists (`frontend/` — hero, how-it-works,
about, contact, FAQ sections). No dashboard, no login page, no data-fetching wired up yet. The
dashboard described in `redvyn-frontend-guide.md` is a separate build that hasn't started.

**Not built yet** (in spec build order, from `CLAUDE.md`): escalation scheduler and sweeper
(§3.5), voice and DTMF (§5.3), WhatsApp templates (§4.2 — ops copies offer links by hand
today), Qwen dialogue (§6.2), prediction and reliability scoring beyond the flat +5 on
confirmation (§3.2, §3.10), radius expansion and blood-bank fallback (§3.7). The
`escalating`, `broadcasting`, `fallback_bloodbank` and `unfilled` case states exist in the
Prisma enum but are unreachable until the scheduler lands.

**Gap this roadmap starts with:** there is no concept of an "account" at all — no `User`
table, no roles, no way to tell admins apart, and no JSON API for a decoupled frontend to call
(everything today is server-rendered `res.render(...)`). Phase 5 below fixes that.

---

## 2. Conventions Qoder must keep (condensed from `CLAUDE.md` — always apply)

- **Layering is one direction:** `routes → controllers → services`. Routes bind URLs only.
  Controllers do req/res + zod validation + `res.render`/`res.json`. Services hold *all*
  domain logic and *all* Prisma calls. Services never import express.
- **Prisma 7, not Prisma 6.** Config is in `prisma.config.ts` (not `package.json`). The
  generator emits **TypeScript** to `src/generated/prisma/` (gitignored) — import enums from
  `../generated/prisma/enums`, the client from `../generated/prisma/client`. `PrismaClient`
  needs the adapter built in `src/db.ts`; always `import { prisma } from "../db"`, never
  construct a client elsewhere. **Always `await` every Prisma call** — a fire-and-forget
  promise silently drops the write.
- **No LLM decides anything.** Auth, role checks, and every state transition are plain code —
  no model inference commits a state change.
- **Phones never touch the wire in plaintext** and reveals must be logged through
  `services/phone.service.ts` — this pattern (encrypt at rest, HMAC lookup hash, logged
  reveal) is the template for anything else sensitive later, including password handling.
- **Slot allocation is a guarded UPDATE**, never read-modify-write. Same discipline applies
  to any new counter.
- **`Event` is append-only, ids only, never PII.** New account/auth actions log here too
  (`auth.login`, `auth.login_failed`, `user.created`, etc. — user id only, never email/name
  in the payload).
- **State transitions raise loudly on illegal input** — never silently ignore.
- Tests follow `test/redvyn.test.ts`'s pattern: run against the real `DATABASE_URL`, tag every
  row a test creates with a per-run marker, delete in `after`, never truncate.
- Minimal dependencies. Prefer `node:crypto` over a library when it can do the job (see
  `src/lib/crypto.ts`) — but for password hashing and JWTs, use the standard libraries named
  in Phase 5 below rather than hand-rolling crypto for those.

---

## 3. Account & Auth Design (decided — Phase 5)

RedVyn's ops console is an **internal admin tool**, not a public product with self-service
signup. Decisions locked in for Phase 5, so every later phase (and the frontend login/signup
pages) build against the same shape:

| Decision | Choice | Why |
|---|---|---|
| Account types | One `User` (admin) model with a `role` field. Donors and families are **not** login accounts — they stay token-link based (`Offer.token`, `Case.familyToken`), matching the spec's "possession of the number is the authentication" design. | Only admins need durable identity; donors/families already have a working, spec-correct auth mechanism. Don't build a second one. |
| Roles (v1) | `admin` only (enum, extensible later — e.g. `read_only`) | `admin` has full access to day-to-day ops (donors, patients, cases, hospitals). Matches the small-team reality of an ops console without over-engineering permissions nobody asked for yet. |
| Account creation | **No public sign-up.** Only an `admin` can create another admin account (`POST /api/auth/admin/users`, admin-only). First admin comes from a seed script. | Internal tool — public signup would be a security hole for a system that reveals donor/patient phone numbers. |
| Password storage | `bcryptjs` (pure JS, no native build step — matters for whatever the Alibaba Cloud ECS deploy target ends up being), cost factor 12. | Avoids `bcrypt`'s node-gyp compile step; same algorithm, no runtime downside at this scale. |
| Session mechanism | **JWT in an httpOnly, `sameSite=lax`, `secure` (prod) cookie.** Stateless verify — no DB round-trip per request, just signature + expiry check. Payload: `{ sub: userId, role, name, iat, exp }`. | The frontend is becoming a separate Next.js app on another port/origin. A signed cookie works for both the existing EJS ops pages *and* the new JSON API with zero duplicated logic, and stays fast under load since there's no session-store lookup per request — matches the "optimize for latency" priority. |
| Token lifetime | 12h, no refresh-token rotation in v1. | Matches the current 8h session's risk profile (no regression) without the added complexity/credit cost of refresh rotation for a hackathon-scope internal tool. Revisit if the console needs to stay open longer per shift. |
| Cross-origin | `cors` middleware, explicit `FRONTEND_URL` origin allow-list, `credentials: true`. Frontend fetches use `credentials: "include"`. | Cookie-based auth across two origins (`:3000` frontend, `:3001`+ backend) needs this explicitly — the default is closed. |
| Existing EJS `/ops/*` | **Kept, not thrown away.** `/ops/login` now checks real accounts instead of `ADMIN_PASSWORD`, and sets the same JWT cookie the JSON API uses. `requireOps` becomes a thin wrapper around the new `requireAuth`. | The ops console still works today for whoever's testing/demoing while the Next.js dashboard gets built page by page — no dead period where nothing runs. |
| Rate limiting | Basic fixed-window limiter on login routes only (5 attempts / 15 min / IP). | Cheap insurance against brute force on the one truly public-facing endpoint (`/ops/login`, `/api/auth/login`) — everything else already sits behind `requireAuth`. |

**Not doing (explicitly, to keep Phase 5 scoped):** refresh tokens, "remember me", email
verification, password reset flow, granular per-resource permissions beyond
granular permissions, multi-factor auth. Add these later only if a real need shows up — each is a
separate, cheap Qoder prompt once needed, not a reason to bloat Phase 5.

---

## 4. Roadmap — Phase 5 onward

Each phase lists: backend scope, the frontend page(s) it unblocks (per
`redvyn-frontend-guide.md`'s route table), and status.

### ✅ Phases 1–4 — Done
Registries + ops console · matching + case creation · link-based outreach · codes + family
confirmation.

### 🔄 Phase 5 — Authentication & RBAC *(current)*
- `User` model (`id, email, passwordHash, name, role, isActive, lastLoginAt, timestamps`).
- `bcryptjs` password hashing, `jsonwebtoken` signing, httpOnly cookie shared by EJS + JSON API.
- `requireAuth` / `requireRole(...roles)` middleware.
- `/ops/login` migrated off `ADMIN_PASSWORD` to real accounts.
- New JSON endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
  `POST /api/auth/admin/users` (admin-only, creates an admin account).
- Seed script creates the first `admin` from env vars.
- Rate limiting on both login routes. `auth.*` events logged.
- **Frontend unblocked:** `/login` page (Next.js dashboard), the auth cookie/fetch wrapper in
  `src/lib/api.ts` that every later dashboard page depends on.

### Phase 6 — JSON API: Donors, Patients, Hospitals
- Read/write JSON endpoints mirroring what `/ops/donors`, `/ops/patients`, `/ops/hospitals`
  already do server-side (list, create, status change, audited phone/guardian reveal).
- Reuse `registry.service.ts` and `phone.service.ts` as-is — this is a controller-layer
  addition, not new domain logic.
- **Frontend unblocked:** Donors List/Profile, Patients List/Profile pages.

### Phase 7 — JSON API: Cases
- List/detail/create/promote as JSON, including the offer lineup and event timeline for the
  Case Detail page's state-machine visual (must mirror backend `CaseState` 1:1 — never invent
  frontend-only states, per the frontend guide's own note).
- **Frontend unblocked:** Cases List, Case Detail, Manual Case Creation.

### Phase 8 — Dashboard overview stats endpoint
- Aggregate counts (open cases by state, today's confirmations, donor pool size, etc.) — plain
  SQL aggregation, no new invariants.
- **Frontend unblocked:** Dashboard Overview (`/dashboard`).

### Phase 9 — Escalation scheduler & sweeper (§3.5)
- The cron/interval job that currently has only a manual stand-in (`promoteStandby`). Handles
  offer timeouts, auto-promotion, and `case.lineup_exhausted` on real elapsed time instead of a
  button click.
- Prerequisite for Phase 10 (emergency mode) to behave correctly under real timing.

### Phase 10 — Emergency broadcast + atomic allocation (§3.6) as JSON API
- Fast-entry case creation, parallel broadcast, the guarded-UPDATE slot allocation already
  described as an invariant, exposed for the live tracker.
- **Frontend unblocked:** Emergency Live Tracker, Emergency Case Creation.

### Phase 11 — Radius expansion & blood-bank fallback (§3.7)
- 5km → 15km → 30km re-match on no acceptance; fallback notification path.
- **Frontend unblocked:** Blood Bank Fallback page.

### Phase 12 — Pending-review + Audit log JSON endpoints (§3.9, §5.5)
- The 24h-unconfirmed-case review queue, and a paginated read view over `Event`.
- **Frontend unblocked:** Pending Review, Audit Log pages.

### Phase 13 — WhatsApp template outreach (§4.2)
- Replace "ops copies the offer link by hand" with real template sends. Six templates need
  WhatsApp Business approval — spec flags this as slow, start the approval process early.

### Phase 14 — Voice, DTMF, Qwen dialogue (§5.3, §6.2)
- Largest remaining phase. DTMF path first (spec's own recommendation — Urdu ASR is the
  weakest link, design so nothing critical depends on it).

### Phase 15 — Prediction & reliability scoring automation (§3.2, §3.10)
- Nightly job for `predictedNextAt`, reliability score beyond the flat +5 on confirmation.

### Phase 16 — Public-facing pages backend support
- Donor registration API (self-service, distinct from admin auth — this *is* meant to be
  public, consent-gated per §3.1), contact form handling, etc.

---

## 5. Environment variables — running list

Keep `.env.example` in sync as each phase lands. As of Phase 5:

```
DATABASE_URL=
PHONE_ENC_KEY=
PHONE_HASH_KEY=
SESSION_SECRET=            # drop once Phase 5 fully replaces express-session, if it does
JWT_SECRET=                # new — 32+ byte random, distinct from the two phone keys above
JWT_TTL=12h                # new
ADMIN_EMAIL=                # new — seed script's first admin
ADMIN_SEED_PASSWORD=        # new — seed script's first admin (change after first login)
FRONTEND_URL=http://localhost:3000   # new — CORS allow-list origin
PORT=3000
BASE_URL=
NODE_ENV=
```
`ADMIN_PASSWORD` is removed once Phase 5 ships — the shared-password model it backed no longer
exists.

---

## Appendix — Qoder prompt: Phase 5 (Authentication & RBAC)

Copy everything in the fenced block below into Qoder as one prompt.

```
Implement Phase 5 of the RedVyn backend roadmap: admin authentication and role-based access,
replacing the single shared ADMIN_PASSWORD. Follow backend/CLAUDE.md's layering
(routes → controllers → services, services never import express) and its Prisma 7 conventions
(generator emits TS to src/generated/prisma; import { prisma } from "../db"; always await
every Prisma call).

1. Prisma schema (backend/prisma/schema.prisma):
   - Add `enum Role { admin }`
   - Add `model User { id String @id @default(cuid()); email String @unique; passwordHash
     String; name String; role Role @default(admin); isActive Boolean @default(true);
     lastLoginAt DateTime?; createdAt DateTime @default(now()); updatedAt DateTime
     @updatedAt }`
   - Run a migration (npm run migrate) with a clear name like `add_users_and_roles`.

2. Dependencies: add `bcryptjs` and `jsonwebtoken` (+ `@types/bcryptjs` and
   `@types/jsonwebtoken` as devDependencies), and `cors` (+ `@types/cors`) for cross-origin
   cookie auth, and `express-rate-limit` for login throttling.

3. src/lib/password.ts: hashPassword(plain) using bcryptjs at cost 12, verifyPassword(plain,
   hash).

4. src/lib/jwt.ts: signAuthToken({ sub, role, name }) -> string using JWT_SECRET and JWT_TTL
   from env (default 12h), verifyAuthToken(token) -> payload or throws. Fail fast if
   JWT_SECRET is unset, same pattern as PHONE_ENC_KEY in src/lib/crypto.ts.

5. src/services/auth.service.ts (all Prisma calls + domain logic live here, not in
   controllers):
   - login(email, password): find active User by email, verify password, update lastLoginAt,
     write an Event (type "auth.login" or "auth.login_failed", userId only, no email/name in
     payload), return { user, token }.
   - createAdminUser({ email, password, name, role }): admin-only caller enforced by the route
     layer (middleware), hash password, create User, write "user.created" Event with the
     new user's id only.
   - Do not put password/JWT logic in controllers — controllers call this service.

6. src/middleware/auth.ts:
   - Replace the body of requireOps so it verifies the JWT cookie (name it "redvyn_token")
     via verifyAuthToken, attaches the decoded payload to req.user, and redirects to
     /ops/login on failure (keep requireOps's existing redirect behavior for the EJS routes).
   - Add requireAuth(req, res, next): same verification, but respond 401 JSON on failure
     instead of redirecting — for the new API routes.
   - Add requireRole(...roles: Role[]) returning a middleware that 403s if req.user.role
     isn't in the list. Compose after requireAuth.
   - Extend the Express Request type (src/types.d.ts) with `user?: { sub: string; role:
     "admin"; name: string }`.

7. Update src/controllers/ops.controller.ts:
   - postLogin: replace the ADMIN_PASSWORD/safeEqual check with auth.service.login(). On
     success, set the "redvyn_token" cookie (httpOnly, sameSite: "lax", secure: NODE_ENV ===
     "production", maxAge matching JWT_TTL) instead of req.session.ops = true, then redirect
     to /ops. On failure, re-render the login view with an error, same as today.
   - postLogout: clear the "redvyn_token" cookie and redirect to /ops/login (res.clearCookie,
     not session destroy — leave express-session in place for now, just stop using it for
     ops auth).
   - Update views/ops/login.ejs only if the form needs an email field added alongside
     password — it does, since login is now email+password.

8. New: src/controllers/api/auth.controller.ts + src/routes/api/auth.routes.ts:
   - POST /api/auth/login -> { email, password } zod-validated, same auth.service.login(),
     sets the same "redvyn_token" cookie, responds 200 { user: { id, email, name, role } }
     (never the password hash) or 401 { error }.
   - POST /api/auth/logout -> clears the cookie, 204.
   - GET /api/auth/me -> requireAuth, returns the current user's public fields (look it up by
     req.user.sub — don't just echo the JWT payload, isActive may have changed).
   - POST /api/auth/admin/users -> requireAuth, requireRole("admin"), zod-validated { email,
     password, name, role }, calls auth.service.createAdminUser(), 201 with the created user's
     public fields.
   - Mount this router at /api/auth in src/routes/index.ts.

9. src/server.ts: add `cors({ origin: process.env.FRONTEND_URL, credentials: true })` before
   the router, and `cookie-parser` if the app doesn't already parse cookies (check — if
   express-session already parses cookies for you, confirm req.cookies is populated for the
   new JWT cookie too, add cookie-parser if not). Add express-rate-limit (5 requests / 15 min,
   keyed by IP) applied only to POST /ops/login and POST /api/auth/login.

10. prisma/seed.ts: idempotently upsert one admin User from ADMIN_EMAIL / ADMIN_SEED_PASSWORD
    env vars (skip if a User with that email already exists), hashed via the same
    password.ts helper. Log a clear console message with the seeded email (never the
    password) on success.

11. .env.example: remove ADMIN_PASSWORD, add JWT_SECRET, JWT_TTL=12h, ADMIN_EMAIL,
    ADMIN_SEED_PASSWORD, FRONTEND_URL=http://localhost:3000, with the same style of comment
    as the existing PHONE_ENC_KEY block explaining how to generate JWT_SECRET.

12. Tests (test/auth.test.ts), following test/redvyn.test.ts's existing pattern exactly (real
    DATABASE_URL, per-run marker tag on every row created, cleanup in `after`, never
    truncate): cover successful login sets a valid cookie, wrong password 401s, an inactive
    user can't log in, requireRole blocks a donor role from POST /api/auth/admin/users with 403,
    and GET /api/auth/me 401s with no cookie and 200s with one.

Do not touch case/offer/donor/patient domain logic, matching, or any of the existing
services beyond adding the auth service and middleware described above. Do not add refresh
tokens, password reset, or email verification — out of scope for this phase.
```
