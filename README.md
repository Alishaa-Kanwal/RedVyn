# RedVyn: Right Donor. Right Time. Real Lives.



## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Our Solution](#2-our-solution)
3. [Differentiation](#3-differentiation)
4. [Alibaba Cloud Integration](#4-alibaba-cloud-integration)
5. [System Architecture](#5-system-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Database Schema](#7-database-schema)
8. [Core Domain Logic](#8-core-domain-logic)
9. [Case Lifecycle (State Machine)](#9-case-lifecycle-state-machine)
10. [API Reference](#10-api-reference)
11. [Authentication & Access Control](#11-authentication--access-control)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Security & Privacy](#13-security--privacy)
14. [Testing & Quality](#14-testing--quality)
15. [Screenshots](#15-screenshots)
16. [Current Build Status](#16-current-build-status)
17. [Roadmap - What's Next](#17-roadmap--whats-next)
18. [Running the Project Locally](#18-running-the-project-locally)
19. [Key File Map](#19-key-file-map)
20. [Known Limitations](#20-known-limitations)
21. [Screenshot Manifest (Order & Filenames)](#21-screenshot-manifest-order--filenames)

---

## 1. Problem Statement

Thalassemia patients and emergency trauma/surgery cases in Pakistan need blood **fast**, often on a
recurring monthly cycle. Today this is met almost entirely through manual human effort:

- Hospitals and families rely on **phone trees** - manually calling a known list of donors one by one.
- **No central, verified donor registry** exists - donor lists live in personal contacts, informal
  chat groups, and Facebook posts, unmatched against real blood group, location, or eligibility data.
- **Response time is the real killer.** Manual outreach is slow; the same handful of "reliable"
  donors get called repeatedly while hundreds of eligible donors in the city are never contacted.
- **No accountability or history** - no record of who was contacted, who declined, who showed up,
  or who is actually reliable, so hospitals can't plan and patients can't predict their next need.
- **Fragmented communication** - donors and guardians are scattered across phone calls and informal
  chat groups, with no single place to coordinate a request end to end.

## 2. Our Solution

RedVyn is an **automated blood donor-patient matching and coordination platform**. It replaces
manual phone-tree outreach with a verified registry, an intelligent matching engine, and an
automated in-dashboard communication channel.

**End-to-end, RedVyn:**

1. Maintains a **verified registry** of donors (blood group, location, eligibility, reliability
   score) and patients (blood group, condition, hospital, transfusion history).
2. **Automatically matches** a new case to the best-ranked compatible donors nearby - ranked by
   blood compatibility, distance, and a computed reliability score.
3. **Reaches out automatically** - via private, token-based link offers - instead of a human
   manually dialing numbers.
4. **Tracks the full lifecycle** - offer sent → accepted/declined → code issued → donation confirmed
   - in a fully auditable, append-only event log.
5. **Escalates intelligently** without human intervention: promotes standbys, expands the search
   radius, and falls back to partner blood banks on a timer.

![RedVyn landing page / hero section screenshot](screenshots/landing%20page%201.png)

## 3. Differentiation

| What others do | What RedVyn does |
|---|---|
| Informal chat groups / personal contact lists | A structured, verified, queryable donor **registry** with real eligibility and location data |
| Manual calling by hospital staff or family | **Automated matching + automated outreach**, humans only in the loop for exceptions |
| Text-only, ad-hoc outreach with no shared record | **Structured link-based outreach** - every offer, response, and status change happens inside one auditable system |
| No accountability once a donor is contacted | **Append-only audit log** of every action, plus a **reliability score** that improves matching over time |
| Static "find a donor" directories | A **live case lifecycle** with real-time escalation, radius expansion, and blood-bank fallback |
| One-size-fits-all outreach | **Scheduled vs. emergency case types** - primary + 2 standbys vs. up to 8 parallel donors |
| No prediction of future need | Recomputes each patient's **predicted next transfusion date** for proactive outreach |

## 4. Alibaba Cloud Integration

RedVyn's Alibaba Cloud usage comes through **Qoder**, Alibaba Cloud's AI-powered coding assistant,
used throughout development to help design, implement, and debug the codebase - backend services,
frontend components, and the test suite. This satisfies the hackathon's Alibaba Cloud usage
requirement through the development workflow rather than a runtime product feature: Qoder is a
build-time tool the team used to move faster, not a service that RedVyn calls in production. The
deterministic, rule-based case state machine (see Section 8) is unaffected by this - no model of
any kind is involved in the running application or in any state transition.


## 5. System Architecture

```
                         ┌─────────────────────────────┐
                         │        Next.js Frontend      │
                         │  Marketing site + role-based │
                         │  dashboards (Admin, Hospital,│
                         │  Donor, Guardian)             │
                         └───────────────┬───────────────┘
                                         │ fetch (credentials: include)
                                         ▼
                         ┌─────────────────────────────┐
                         │     Express 5 API Server      │
                         │  routes → controllers →       │
                         │  services (strict layering)   │
                         └───────────────┬───────────────┘
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
        ┌────────────────┐   ┌────────────────────┐   ┌─────────────────────┐
        │  PostgreSQL     │   │  Background          │   │  Outreach Channels   │
        │  (Prisma 7 ORM) │   │  Scheduler/Sweeper   │   │  Link offers (live)  │
        │                 │   │  (offer timeouts,     │   │                     │
        │                 │   │  radius expansion,    │   │                     │
        │                 │   │  reliability scoring) │   │                     │
        └────────────────┘   └────────────────────┘   └─────────────────────┘
```

**Layering discipline (enforced across the codebase):** `routes → controllers → services`.
Routes bind URLs only. Controllers handle request/response and validation. **Services hold all
domain logic and all database calls** - services never import Express, keeping business logic
testable and independent of the web framework.


## 6. Technology Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript |
| Framework | Express 5 |
| ORM | Prisma 7 (client generated to `backend/src/generated/prisma`) |
| Database | PostgreSQL |
| Auth | Stateless JWT in an `httpOnly` cookie (`redvyn_token`) |
| Validation | Zod |
| Logging | pino / pino-http |
| Security | helmet, express-rate-limit, express-session, cors |
| Testing | Node built-in test runner + tsx + supertest |
| Dev Tooling | Qoder (Alibaba Cloud AI coding assistant) used during development |

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind CSS 4 + custom CSS variables |
| Fonts | Google Fonts - Playfair Display (headings), Montserrat (body) |
| Theme | `next-themes` (light / dark / system) |
| Forms | `react-hook-form` + `@hookform/resolvers` + Zod |
| Animation | `framer-motion` |
| Icons | `lucide-react` |
| Toast | `sonner` |

## 7. Database Schema

**Enums**

- `BloodGroup`: `A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG`
- `DonorStatus` / `PatientStatus`: `active, paused, opted_out, blocked`
- `PatientCondition`: `thalassemia_major, other`
- `CaseType`: `scheduled, emergency`
- `CaseState`: `draft, matching, awaiting_response, partially_filled, filled, in_progress, confirmed, closed, pending_review, escalating, broadcasting, fallback_bloodbank, unfilled`
- `OfferRole`: `primary, standby_1, standby_2`
- `OfferState`: `pending, accepted, code_issued, completed, no_show, declined, timed_out, released, promoted`
- `ConfirmedBy`: `family, ops`

**Core Models**

| Model | Purpose |
|---|---|
| `Hospital` | Name, city, lat/lon, desk info, verified flag, optional self-service credentials |
| `Donor` | Name, sealed phone (hash + encrypted), blood group, city, lat/lon, eligibility dates, reliability score, status, consent |
| `Patient` | Name, sealed guardian phone, blood group, condition, status, home hospital, interval estimate, last/predicted transfusion, optional Guardian link |
| `Case` | Patient, hospital, type, blood group, units required/secured, slots remaining, state, `neededAt`, window, `expiresAt`, radius, family token, offers, donations |
| `Offer` | Case, donor, role, state, token, optional code/code expiry, sent/responded timestamps |
| `Donation` | Case, donor, patient, code, `confirmedAt`, `confirmedBy` |
| `Event` | **Append-only** audit log - type, timestamp, ids (case/offer/donor/user), payload (ids only, never PII) |
| `User` | Admin/staff accounts (role-based) |
| `Guardian` | Login account linkable to one or more patients |
| `SystemSettings` / `UserPreference` | Platform + per-user configuration |
| `ContactMessage` | Public contact-form submissions |


## 8. Core Domain Logic

**Matching Engine** (`matching.service.ts`) - a raw SQL haversine-distance query ranks all eligible,
active, blood-compatible donors within a configurable radius by distance and reliability score.

**Radius & Fallback** (`radius-fallback.service.ts`) - a defined expansion ladder: 5km → 15km →
30km, then falls back to a partner blood bank if still unfilled.

**Scheduler** (`scheduler.service.ts`) - a periodic sweep (interval-based, `SWEEP_INTERVAL_MS`,
default 60s) that runs four sweeps every cycle:
- `sweepExpiredOffers` - times out primaries past `expiresAt`, auto-promotes standbys
- `sweepRadiusExpansion` - widens the search radius after a wait period
- `sweepLineupExhausted` - marks a case `unfilled` when no open offers remain
- `sweepReliabilityAndPrediction` - recomputes each donor's reliability score and each patient's
  `predictedNextAt` transfusion date

**Design principles enforced throughout the codebase** (from the project's own conventions doc):
- **No LLM decides anything.** No model of any kind runs in the production application - auth, role
  checks, and every state transition are plain deterministic code.
- **Slot allocation is a guarded UPDATE, never read-modify-write** - prevents race conditions when
  multiple donors respond to the same case simultaneously.
- **Phones never touch the wire in plaintext.** All reveals are logged through a single service
  (encrypt at rest, HMAC lookup hash, logged reveal) - this pattern is the template for all
  sensitive-data handling.
- **State transitions raise loudly on illegal input** - never silently ignored.
- **`Event` is append-only, ids only, never PII** - every account action, every offer transition,
  every chat message attempt writes here.

## 9. Case Lifecycle (State Machine)

```
create case → matching → awaiting_response ─┬─→ partially_filled → filled → in_progress
                                              │                                   │
                                              ├─→ escalating (timeout/no response) │
                                              ├─→ broadcasting (emergency mode)     │
                                              ├─→ fallback_bloodbank (radius exhausted)
                                              └─→ unfilled (all lineups exhausted)  │
                                                                                    ▼
                                                                          confirmed → closed
                                                                                │
                                                                    (24h unconfirmed)
                                                                                ▼
                                                                        pending_review
```

**Step-by-step:**

1. **Create case** (`POST /api/cases`, admin) - validates patient/hospital, ensures `neededAt` is in
   the future, calls the matching engine, creates the case in `awaiting_response`, creates offers
   (scheduled = primary/standby_1/standby_2; emergency = up to 8 parallel primaries).
2. **Donor receives offer** - via a private, token-based link.
3. **Accept offer** - an atomic `UPDATE` decrements `slotsRemaining`, increments `unitsSecured`,
   transitions state to `partially_filled`/`filled`, and issues a 4-digit donation code.
4. **Decline offer** - marks the offer declined; for scheduled primaries, auto-promotes `standby_1`.
5. **Confirm donation** - requires the case's `familyToken` + donor code; creates a `Donation`,
   updates the donor's eligibility window and the patient's transfusion history, and closes the case
   once no codes remain outstanding.
6. **Scheduler sweeps** run continuously in the background to handle timeouts, escalation, and
   prediction without any human needing to notice a case has stalled.

## 10. API Reference

| Base | Routes | Auth |
|---|---|---|
| `/api/auth` | login, signin, signup, logout, me, donor/guardian/hospital register & login, admin users | Mixed |
| `/api/donors` | list (admin), `/me/history` (donor), detail, create, status patch, reveal phone | `requireAuth` + role gates |
| `/api/patients` | list, detail, create, status patch, reveal guardian phone | `requireAuth` + role gates |
| `/api/hospitals` | list (admin), detail, public list, create, update, verify | `requireAuth` + role gates |
| `/api/cases` | list, detail, timeline, create (admin), promote standby (admin), pending-review (admin) | `requireAuth` + role gates |
| `/api/emergency` | create emergency case (admin), live tracker | `requireAuth` + role gates |
| `/api/dashboard` | `/overview` (admin) | `requireAuth` + admin |
| `/api/audit-log` | paginated audit log | `requireAuth` + admin |
| `/api/settings` | system settings, user preferences | `requireAuth` + admin |
| `/api/contact` | public contact form | Public |

## 11. Authentication & Access Control

- **Stateless JWT** in an `httpOnly`, `sameSite=lax`, `secure` (prod) cookie (`redvyn_token`) - no
  session-store lookup per request, keeping latency low. Payload: `{ sub: userId, role, name }`.
- `requireAuth` - verifies the cookie and attaches `req.user`, or returns 401.
- `requireRole(...roles)` - checks `req.user.role`, or returns 403.

| Role | Identity Table | Access |
|---|---|---|
| `admin` | `User` | Full platform management |
| `hospital` | `Hospital` | Own hospital record + linked cases |
| `donor` | `Donor` | Own profile, offers, donations |
| `guardian` | `Guardian` | Linked patients + those patients' cases |

Role-scoped reads are enforced centrally in `registry.service.ts` (`canAccessPatient`,
`canAccessCase`, `caseScopeWhere`) - not re-implemented per route, so access rules can't drift.

Rate limiting (5 requests / 15 min / IP) is applied to both login routes as brute-force protection.

![Sign in screen](screenshots/sign%20in.png)
![Sign up screen](screenshots/sign%20up.png)

## 12. Frontend Architecture

- **Root layout** wraps the app in `ThemeProvider` (light/dark/system) and `AuthProvider`.
- **`AuthProvider`** fetches `/api/auth/me` on mount and exposes `signin/signup/signout/refresh`,
  routing each role to its own dashboard (`/dashboard/admin`, `/donor`, `/guardian`, `/hospital`).
- **Registry pattern** (`use-registry.js` + `registry-page.js`) - a single reusable hook/component
  pair drives every list/detail/create/status-change page (Donors, Patients, Hospitals, Cases) from
  a config object, rather than duplicating CRUD UI per domain.
- **Admin dashboard** - stat cards, case-status donut, response-time gauge, activity feed, emergency
  broadcast banner, live map panel.
- **Guardian preview dashboard** - a full, purpose-built experience (Dashboard, My Patient, Upcoming
  Transfusions, Requests, History, Messages, Milestones, Help Center) reading real backend data
  (`predictedNextAt`, real `CaseState` values mapped through a shared status config - never invented
  frontend-only states).

![Admin dashboard overview screenshot](screenshots/admin%20dashboard.png)
![Guardian dashboard screenshot](screenshots/guardian%20dashboard.png)
![Case detail / lifecycle view screenshot](screenshots/case-detail-lifecycle.png)


## 13. Security & Privacy

- Donor and guardian phone numbers are **encrypted at rest** and looked up via an HMAC hash - never
  stored or transmitted in plaintext.
- Every reveal of a phone number is an **audited, logged action**, not a silent field read.
- The audit `Event` log stores **ids only, never PII**, for every account, offer, and case action.
- Passwords hashed with `bcryptjs` (cost factor 12); JWTs signed with a dedicated secret distinct
  from the phone encryption/HMAC keys.
- CORS is explicitly allow-listed to the known frontend origin with `credentials: true` - the
  default posture is closed.
- Helmet + rate limiting on all public-facing auth endpoints.

## 14. Testing & Quality

- Node's built-in test runner + `tsx` + `supertest`, run against the real `DATABASE_URL` - no mocked
  database layer, so tests exercise real Prisma queries and constraints.
- Each test run tags every row it creates with a per-run marker and deletes (never truncates) in
  `after`, so the test suite is safe to run against a shared database.
- **Current status: 87/87 backend tests passing**, `npm run typecheck` clean, `npm run dev` starts
  successfully, frontend `npm run build` passes.


## 15. Screenshots

All images below are pulled from the `screenshots/` folder at the root of the repository. A few
extra product surfaces (emergency live tracker, audit log, donor offer page, patient details /
upcoming transfusions) don't have a captured screenshot yet and are marked `(pending capture)`.

**Landing / Marketing Site**
![Landing page 1](screenshots/landing%20page%201.png)
![Landing page 2](screenshots/landing%20page%202.png)
![Landing page 3](screenshots/landing%20page%203.png)
![Landing page 4](screenshots/landing%20page%204.png)
![Landing page 5](screenshots/landing%20page%205.png)
![Landing page 6](screenshots/landing%20page%206.png)
![Landing page 7](screenshots/landing%20page%207.png)
![Landing page 8](screenshots/landing%20page%208.png)
![Landing page 19](screenshots/landing%20page%2019.png)

**Authentication**
![Sign in](screenshots/sign%20in.png)
![Sign up](screenshots/sign%20up.png)

**Admin Dashboard**
![Admin dashboard](screenshots/admin%20dashboard.png)
![Admin dashboard 2](screenshots/admin%20dashboard%202.png)
![Admin dashboard 3](screenshots/admin%20dashboard%203.png)
![Admin dashboard 4](screenshots/admin%20dashboard%204.png)
![Donor registry](screenshots/donor-registry.png)

![Case detail with lifecycle timeline](screenshots/case-detail-lifecycle.png)

![Emergency live tracker](screenshots/emergency-live-tracker.png)

![Audit log](screenshots/audit-log.png)



![Donor dashboard](screenshots/donor%20dashboard.png)

**Guardian Experience**
![Guardian dashboard](screenshots/guardian%20dashboard.png)


**Hospital Experience**
![Hospital dashboard](screenshots/hospital%20dashboard.png)

## 16. Current Build Status

RedVyn already has a working, tested backend and real product surface - this is a running system,
not a concept:

- ✅ Full donor/patient/hospital registries with role-based dashboards (Admin, Hospital, Donor, Guardian)
- ✅ Live matching engine and complete case lifecycle (create → match → offer → accept/decline →
  promote → confirm → close)
- ✅ Emergency broadcast mode with atomic slot allocation
- ✅ Automatic radius expansion and blood-bank fallback on no response
- ✅ Background scheduler sweeping expired offers and recomputing reliability/prediction
- ✅ Full append-only audit log with role-scoped access control
- ✅ JWT auth with role-based access control across 4 roles
- ✅ 87/87 backend tests passing
- ✅ Built with **Qoder** (Alibaba Cloud's AI coding assistant) used throughout development

## 17. Roadmap - What's Next

### Alibaba Cloud Usage - Qoder
Qoder (Alibaba Cloud's AI coding assistant) was used throughout development to help build and debug
the platform. This is a development-workflow integration, not a runtime feature - no AI model runs
inside the deployed application, and no case, offer, or account state is ever decided by a model
(see Section 8's design principles).

### Prediction & Reliability Automation *(next)*
A nightly job to keep `predictedNextAt` and donor reliability scores current beyond the flat +5
adjustment on confirmation, enabling proactive rather than reactive outreach.

### Public Self-Service Surfaces *(next)*
Consent-gated donor self-registration, guardian self-service emergency case creation, and public
contact-form handling.

## 18. Running the Project Locally

### Backend
```bash
cd backend
npm install
npm run migrate   # apply Prisma migrations
npm run seed      # seed admin + sample data
npm run dev       # build + watch server (http://localhost:4000)
npm run test      # run full test suite
npm run typecheck # TypeScript check
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run lint      # ESLint
```

### Key Environment Variables

```env
# backend/.env
DATABASE_URL="postgresql://..."
PHONE_ENC_KEY="..."          # 32-byte hex
PHONE_HASH_KEY="..."         # 32-byte hex, different from enc key
JWT_SECRET="..."
JWT_TTL="12h"
ADMIN_EMAIL="admin@redvyn.local"
ADMIN_SEED_PASSWORD="..."
PORT=4000
BASE_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
NODE_ENV=development

# frontend/.env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_HELPLINE=+92 300 1234567
NEXT_PUBLIC_SUPPORT_EMAIL=support@redvyn.org
NEXT_PUBLIC_SUPPORT_PHONE=+92 300 1234567
NEXT_PUBLIC_OFFICE_ADDRESS=Lahore, Pakistan
```

## 19. Key File Map

**Backend**
```
backend/src/server.ts                    # Express app + scheduler start
backend/src/routes/index.ts              # API router mounting
backend/src/routes/api/*.routes.ts       # Per-domain route files
backend/src/controllers/api/*.ts         # Request handlers + Zod schemas
backend/src/services/*.ts                # All business logic + Prisma calls
backend/src/middleware/auth.ts           # JWT auth middleware
backend/src/middleware/error.ts          # AppError + error handler
backend/src/lib/jwt.ts                   # JWT sign/verify
backend/prisma/schema.prisma             # Data model
```

**Frontend**
```
frontend/src/app/layout.js               # Root layout: ThemeProvider, AuthProvider
frontend/src/app/page.js                 # Marketing landing page
frontend/src/app/auth/signin/page.js     # Login
frontend/src/app/dashboard/layout.js     # Production dashboard shell
frontend/src/app/dashboard/admin/        # Admin pages
frontend/src/app/dashboard/donor/        # Donor pages
frontend/src/app/dashboard/hospital/     # Hospital pages
frontend/src/app/(preview)/dashboard/preview/guardian/  # Guardian preview
frontend/src/components/auth-provider.js # Auth context
frontend/src/lib/api.js                  # apiFetch + authApi/settingsApi
frontend/src/hooks/use-registry.js       # Registry CRUD hooks
```

## 20. Known Limitations

Transparent about current gaps - these are the honest next steps, not hidden issues:

- `ops.routes.ts` and `public.routes.ts` are defined but not yet mounted in the main router.
- Guardian self-service case creation is not yet supported (`POST /api/cases` is admin-only).
- No guardian-scoped donation history endpoint yet.
- Patient photo, age, and hemoglobin level are not yet stored/rendered (backend gap, not a design
  decision - the frontend already has UI slots for them, ready as soon as the fields exist).
- Notifications service (fallback blood-bank alerts) is currently a placeholder.

## 21. Screenshot Manifest (Order & Filenames)

All captured screenshots live in the `screenshots/` folder at the root of the repository (alongside
`frontend/` and `backend/`). This list is in the same order the images appear in this document.

### Captured (18 images, already in `screenshots/`)

| # | Filename (in `screenshots/`) | Used in |
|---|---|---|
| 1 | `landing page 1.png` | Section 2 (hero), Section 15 |
| 2 | `landing page 2.png` | Section 15 |
| 3 | `landing page 3.png` | Section 15 |
| 4 | `landing page 4.png` | Section 15 |
| 5 | `landing page 5.png` | Section 15 |
| 6 | `landing page 6.png` | Section 15 |
| 7 | `landing page 7.png` | Section 15 |
| 8 | `landing page 8.png` | Section 15 |
| 9 | `landing page 19.png` | Section 15 |
| 10 | `sign in.png` | Section 11, Section 15 |
| 11 | `sign up.png` | Section 11, Section 15 |
| 12 | `admin dashboard.png` | Section 12, Section 15 |
| 13 | `admin dashboard 2.png` | Section 15 |
| 14 | `admin dashboard 3.png` | Section 15 |
| 15 | `admin dashboard 4.png` | Section 15 |
| 16 | `donor dashboard.png` | Section 15 |
| 17 | `guardian dashboard.png` | Section 12, Section 15 |
| 18 | `hospital dashboard.png` | Section 15 |

### Still pending capture

| # | Filename (save into `screenshots/`) | What to capture | First appears in |
|---|---|---|---|
| 1 | `qoder-usage.png` | Qoder in use (IDE session or Alibaba Cloud console) | Section 4 |
| 2 | `architecture-diagram.png` | System architecture diagram | Section 5 |
| 3 | `prisma-schema-erd.png` | Prisma schema / ERD export | Section 7 |
| 4 | `case-detail-lifecycle.png` | Case detail page with lifecycle timeline | Section 12 |
| 5 | `test-suite-passing.png` | Test suite passing / CI run output | Section 14 |
| 6 | `donor-registry.png` | Donor registry list view | Section 15 |
| 7 | `emergency-live-tracker.png` | Emergency case live tracker | Section 15 |
| 8 | `audit-log.png` | Audit log view | Section 15 |
| 9 | `donor-offer-page.png` | Donor offer (accept/decline) page | Section 15 |
| 10 | `patient-details-upcoming.png` | Patient details / upcoming transfusions view | Section 15 |

**Total images: 18 captured, 10 still pending.**

---

*RedVyn - built for the Alibaba Cloud AI Hackathon Pakistan. This document reflects the codebase as
of the date on the accompanying repository commit.*
