# KoryoGraph — Autonomous Build Instructions (v1.0)

**What this is.** The complete specification and execution plan for building the KoryoGraph prototype: an
AI-native, modular operations platform for martial arts schools, built to be a credible and flat-out-better
competitor to Spark Membership (and Zen Planner, Kicksite, Gymdesk). It is written to be executed **start to
finish by an autonomous coding agent** (Claude Code on desktop) with no human in the loop, and to survive
context loss mid-run.

**Trigger.** Do nothing until the human says **"go"**. On "go", run §0.9 Preflight, then start M0.01 and do
not stop until the Stop Conditions in §0.8 are met.

**Target environment.** Claude Code **desktop** on John's machine, with unrestricted network. Supabase is the
platform (Auth, Postgres, Storage). Stripe in test mode. OpenRouter for all AI. See §0.7 for prerequisites.

---

## Table of contents

- §0 Operating protocol — READ FIRST, re-read on every resume
- §1 As-built state — what exists, what to keep, what to delete
- §2 Product definition (PRD) — vision, competitive wedge, personas, modules & packaging, feature spec, AI layer, NFRs
- §3 Technical architecture — stack, repo layout, auth & tenancy, RLS, data access, payments, AI gateway, comms, jobs, testing, design system
- §4 Data model — target schema, table by table
- §5 Milestones M0–M5 — tasks, acceptance criteria, gates
- §6 The Alex demo script — final acceptance E2E
- §7 HANDOFF — deployment checklist and live smoke tests
- Appendix A — Feature parity matrix (Spark / Zen Planner / Kicksite / Gymdesk → KoryoGraph)
- Appendix B — Gate scripts and guard tests
- Appendix C — Seed data specification ("Ridgeline Taekwondo")
- Appendix D — PROGRESS.md template, commit conventions, FINAL-REPORT format

---

# §0 Operating protocol

## 0.1 Prime directive and the honesty rules

The repo you start from failed in a specific way: it **simulated** the product. A chatbot that `setTimeout`s
a canned reply claiming "Supabase data integrations are active"; a "Pay Dues Now" button with no handler; a
biomechanics panel whose own copy says "simulated"; a fabricated logged-in user when auth is absent; a
roadmap marking unbuilt things ✅. It looked functional and was ~10% real. **You will not do this.**

Non-negotiable rules, enforced by gates where possible and by you always:

1. **Nothing is faked.** No `MOCK_*` constants rendered as data. No hardcoded KPIs. No `setTimeout` posing
   as an API. No fabricated users. An unbuilt feature is **absent** or an honest empty state — never a
   lookalike.
2. **Every screen reads and writes the real database** through the real data layer under real authorization
   (RLS). Never bypass auth "for preview".
3. **External services are real code paths.** Stripe runs in test mode against real Stripe. AI runs against
   real OpenRouter. Email/SMS run against real providers when keys exist, otherwise land in a visible
   **Outbox** (a real feature: "not sent — no provider configured"). When a key is missing, the UI says so
   plainly. Recorded fixtures exist only for automated tests, never in a running UI.
4. **A failing gate is reported as failing.** Never edit a test to pass, skip it, loosen an assertion, or
   mark a task done that isn't. After the retry budget, record BLOCKED with a diagnosis (§0.5) and move on.
5. **Tenant isolation is enforced in the database.** Every tenant-scoped table has RLS with a policy; a
   guard test fails the build if any table has RLS enabled with zero policies (the old schema's fatal
   defect), or a tenant-scoped table lacks a tenant predicate.
6. **Minors' data is sensitive by default.** Student video/audio is processed by AI only with a recorded
   guardian consent flag, and every AI run on it is logged.

## 0.2 The loop

You execute **milestones** M0…M5. Each has numbered **tasks** (`M1.04`). Each task is small enough to finish
and commit in one sitting and has an **Acceptance** clause you can verify mechanically.

```
LOOP(task):
  1. READ    docs/build/PROGRESS.md → confirm this is the current task; note logged deviations.
  2. PLAN    Re-read the task in §5 and the §3/§4 sections it cites. List the files you'll touch.
  3. BUILD   Implement. Small, typed, tested. Follow §0.6.
  4. VERIFY  Run the task's Acceptance command(s). Then `npm run check` (typecheck + lint + unit).
             DB touched → `npm run test:db`. Routes touched → the named Playwright spec.
  5. FIX     On failure: read the actual error, fix, back to 4. Budget: 3 full attempts per task.
             Never "fix" by weakening the check.
  6. COMMIT  git add -A && git commit -m "<type>(<task-id>): <summary>"   (Appendix D)
  7. RECORD  Update docs/build/PROGRESS.md: task → done + SHA; "Current task" → next.
  8. NEXT    Continue immediately. Do not ask permission. Do not stop to summarize.
```

```
GATE(milestone):
  1. npm run gate -- <milestone>        (Appendix B: typecheck, lint, unit, db, e2e — cumulative)
  2. Green → git tag <milestone>-complete && git push -u origin <branch> --tags. Record in PROGRESS.md.
  3. Red → fix (budget 3). Still red → log BLOCKED per §0.5, push anyway, continue. Downstream tasks
     that depend on a blocked task are marked blocked; skip to the next independent task.
```

**Push cadence:** every milestone gate, and at least every 10 task commits. Push only to the working branch.
Never open a PR unless asked.

## 0.3 State files

Created in M0.02 under `docs/build/`:

- `PROGRESS.md` — single source of truth for build position (template Appendix D). Updated on every task
  completion, gate, and block. **On any resume, read this first.**
- `DECISIONS.md` — append-only ADR log. Any deviation from this document (library broken, API changed,
  contradictory spec) gets: date, task, what the doc said, what you did, why. Deviations are allowed;
  **undocumented** deviations are not.
- `FINAL-REPORT.md` — written once at the end (§0.8).

## 0.4 Resuming after context loss

When you notice you are resuming (a summary precedes you / no memory of the last tool call):

1. `cat docs/build/PROGRESS.md` → find "Current task".
2. Re-read **§0 only**, in full.
3. Read the §5 entry for the current milestone; skim the §3/§4 sections it cites.
4. `git status && git log --oneline -5`. Dirty tree → finish or revert that task deliberately.
5. Re-enter LOOP at step 2.

Do not re-read the whole document. Do not redo the audit. Do not re-litigate `DECISIONS.md`.

## 0.5 BLOCKED protocol

After 3 genuine attempts on a task or gate:

1. Append to `PROGRESS.md` → "Blocked": task id, one-paragraph diagnosis (actual error text, what you
   tried), what a human must do or decide.
2. If the blocker is a **missing key/service** (no Stripe key, OpenRouter quota, DNS), it is not a defect:
   record under "HANDOFF items" and keep the code path real and covered by its test double.
3. Move to the next task not depending on the blocked one. Gate scripts exclude tests tagged with a blocked
   task id **only if** that id is in PROGRESS.md's Blocked table (Appendix B). That is the one sanctioned way
   a red test coexists with progress, and it appears in the final report.

Never: delete a failing test, `.skip` silently, comment out an assertion, widen to `any`, or swallow an
exception to make a page render.

## 0.6 Rules of engagement

- **TypeScript strict, zero `any`** (`unknown` + narrowing). ESLint errors block commits.
- **Pin dependencies** to §3.1 versions. No mid-run upgrades. If a pin is broken, use the nearest working
  version and log it.
- **Read the `.d.ts` in `node_modules` before using any API you're not certain of** (Supabase SSR/auth,
  Stripe, openai, rrule, pg-boss/cron patterns). Do not guess signatures.
- **Server-first.** Mutations are server actions or route handlers, zod-validated, executed with the
  user-scoped Supabase client (RLS enforced). The service-role client is used **only** in webhooks, jobs,
  and platform-admin code under `src/server/admin/**`, never from a user request path. No secrets in
  client bundles.
- **One way per concern.** Forms: react-hook-form + zod. Tables: shared `DataTable`. Dates: date-fns,
  stored UTC (`timestamptz`), displayed in tenant timezone. Money: integer cents + `currency`. IDs: uuid.
- **Tests next to code** (`*.test.ts`) for unit; `tests/db/*` for schema/RLS; `tests/e2e/*` Playwright.
  Every Acceptance is a test or command that exits non-zero on failure.
- **Deterministic seed** (seeded PRNG): `npm run db:reset` twice yields identical data.
- **Accessibility is required:** semantic HTML, labeled inputs, focus rings, keyboard-operable dialogs,
  4.5:1 contrast. Kiosk and Home are used by non-technical people and children's guardians.
- **Mobile-first for Mat and Home; desktop-first for Desk.** Every route renders at 390px and 1280px.
- **Logging:** pino, structured, `tenant_id` + `user_id` on every server line. No `console.log` in
  committed app code.
- **Commit small and often.** One task = ≥1 commit. Conventional commits (Appendix D).
- **Don't gold-plate.** Build the Acceptance, make it correct, move on. Depth comes from later tasks.

## 0.7 Prerequisites (desktop) and environment facts

John installs these **before "go"** (the Preflight in §0.9 checks them):

| Requirement | Why | Check |
|---|---|---|
| Node ≥ 22, npm ≥ 10 | Toolchain | `node -v` |
| Docker Desktop running | `supabase start` local stack (Postgres+Auth+Storage+Studio) for dev & tests | `docker info` |
| Supabase CLI | migrations, local stack, type generation | `supabase --version` |
| Stripe CLI, logged in to a **test-mode** account | webhook forwarding (`stripe listen`), test events | `stripe --version` |
| `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_PUBLISHABLE_KEY` (pk_test_…) | payments in test mode | in `.env.local` |
| `OPENROUTER_API_KEY` | all AI features | in `.env.local` |
| (optional) Resend key, Twilio test creds | real email/SMS; otherwise Outbox | in `.env.local` |
| (optional) Hosted Supabase project + Vercel account | deploying the demo for Alex (§7) | — |

Fallback if Docker is unavailable: create a hosted Supabase project, `supabase link`, and use
`supabase db push` instead of `supabase db reset`; tests run against it (slower, still real). Log it.

Facts to respect: never call the harness's own model endpoints from product code; product AI goes only
through `packages/ai` → OpenRouter. Playwright: `npx playwright install chromium` once in M0.

## 0.8 Stop conditions and final report

Stop only when:

1. **Done** — M5 gate green (or green-with-recorded-blocks), the Alex demo E2E (§6) passes,
   `docs/build/FINAL-REPORT.md` written and pushed; or
2. **Hard stop** — environment unrecoverable (Docker dead and no hosted fallback, git push failing after 4
   backoff retries). Write FINAL-REPORT.md with what you have, commit, stop.

FINAL-REPORT.md (Appendix D): what shipped per milestone, demo click-path status, blocked items with
diagnoses, HANDOFF items, and a candid "known gaps vs §2" list. **Candor is the deliverable.**

## 0.9 Preflight (run on "go", before M0.01)

```bash
node -v && npm -v && docker info >/dev/null && supabase --version && stripe --version
test -f .env.local || cp .env.example .env.local   # after M0 creates .env.example
grep -E '^(STRIPE_SECRET_KEY|OPENROUTER_API_KEY)=' .env.local || echo "WARN: keys missing → HANDOFF"
git status --porcelain | wc -l   # expect 0
```
Record the result as the first entry in PROGRESS.md. Missing optional keys are HANDOFF items, not blockers.

---

# §1 As-built state: what exists, what to keep, what to delete

Audited 2026-09-21 (4 commits, last "Phase 1 Complete: Multi-tenancy & SaaS subscription architecture").

## 1.1 What is real

| Item | Status |
|---|---|
| `apps/login` — email/password + Google/Apple OAuth via Supabase Auth, `user_roles` lookup, OAuth callback route, 5-theme switcher | Works. Only functioning feature in the repo. |
| `apps/login/middleware.ts` — session refresh + role-based redirect (owner/admin→desk, instructor→app, else→home) | Works; no tenant resolution; authorizes on `getSession()` not `getUser()`. |
| `packages/database/src/index.ts` (100 lines) — browser/server/admin Supabase client factories | Works; server client has a hazardous no-op `getAll()`; browser client lacks `cookieOptions` for cross-subdomain SSO. |
| `packages/ui/src/globals.css` (485 lines) — 5 themes (`dark`, `koryo-red`, `light`, `midnight`, `warm`) as CSS variables + `.kg-*` utilities; Inter + Space Grotesk | **Good. Carry the tokens forward** (§3.10). |
| SQL schema, ~1,950 lines (`supabase_schema.sql` + `supabase/schema_part1–5.sql`), 29 tables | Entity inventory useful; implementation not (1.3). |
| `concept_UI.html`, `apps/public/landing-page.html` | Design intent + pricing tiers ($99/$199/$499). Static. |

## 1.2 What is fake

- `apps/app`, `apps/desk`, `apps/home`: **one page each**, all data in hardcoded `MOCK_*` consts. No routes,
  no API handlers, no server actions. `apps/desk`'s sidebar lists 12 destinations that change only a
  breadcrumb string. KPIs are JSX string literals. The "Staff AI" chat is a `setTimeout` echo.
- **Zero writes to the database anywhere.** The only queries in the app tier are three reads of `user_roles`.
- **Stripe**: no SDK installed; exists as type field names and a landing-page price list. The "Pay Dues
  Now" button has no `onClick`.
- **AI**: `packages/ai-core` is 696 lines of 11 classes whose every method throws "not yet implemented";
  no SDK installed; nothing imports it.
- Three apps have no middleware, are publicly reachable, and **fabricate a signed-in user** when Supabase
  is absent.
- Dead links: `/signup`, `/forgot-password`, `/pricing`, `/about`, `/features`, `/contact`, `/privacy`, `/terms`.
- Repo does not `npm install` (`packages/types` has no `package.json`) or typecheck (`apps/login`,
  `apps/desk` import `@repo/database` undeclared). No CI, no tests, no `CLAUDE.md`, no migrations.

## 1.3 Why the schema is rebuilt rather than patched

- RLS is **enabled on all 29 tables but only 5 have any policy** → 24 tables are deny-all.
- **Not one policy filters by `tenant_id`.** "Staff sees all profiles" means all tenants.
- `has_role(user, role)` ignores `tenant_id` → an owner of any tenant passes owner checks everywhere.
- **13 of 29 tables have no `tenant_id`** (attendance_logs, skill_evaluations, student_progression,
  belt_test_registrations, event_registrations, waiver_signatures, class_transcripts, curriculum_ranks,
  skills_checklist, family_members, product_variants, roles, tenants).
- `schema_part5.sql` declares the same policy name twice on `pending_tenants` → **the script aborts**; some
  policies pass a tenant id where a user id is expected (always false).
- `pgvector` enabled, zero vector columns. No migrations directory; two overlapping copies of the schema.

## 1.4 Keep / delete list (executed in M0.03)

**Keep (move/port):**
- `packages/ui/src/globals.css` → token source for `packages/ui/src/styles/tokens.css` (§3.10).
- Entity names and column ideas from the old SQL → informed §4; the files themselves are deleted.
- `KoryoGraph Master PRD.md`, `plans/KoryoGraph-Development-Roadmap.md`, `concept_UI.html`,
  `apps/public/landing-page.html` → move to `docs/archive/` unchanged, with a one-line `README.md` there
  saying they are superseded by this document.
- `.gitignore`, `turbo.json` (edited), root `package.json` (edited), `packages/eslint-config`,
  `packages/typescript-config` (updated for Next 16 / Tailwind 4 as needed).

**Delete:**
- `apps/app`, `apps/desk`, `apps/home`, `apps/login`, `apps/public` (replaced by `apps/web`).
- `packages/ai-core`, `packages/database`, `packages/types`, `packages/ui/src/*.tsx`.
- `supabase_schema.sql`, `supabase/schema_part1–5.sql`, `.env.local.example`, root `README.md` (rewritten).

---

# §2 Product definition (PRD)

## 2.1 Vision and positioning

**KoryoGraph** ("choreograph the school") is the operating system for a martial arts school: one tenant, one
database, three surfaces — **Desk** (owner/front desk), **Mat** (instructors, tablet, mat-side), **Home**
(parents/students) — plus a **Public** site with self-serve signup. It is **modular** (schools license only
what they use), **AI-native** (agents draft, humans approve), and **exportable by design** (every table has a
one-click CSV/JSON export and a public API; leaving is easy, so staying is a choice).

**The wedge against Spark** (from documented reviews and market research):
1. **Lock-in and rigidity.** Users report having to "create dummy classes" to fit their schedule, weak
   third-party integrations, and no clean exit. KoryoGraph: flexible schedule rules, open API, full export.
2. **Domain gaps.** Multi-program schools (TKD + BJJ + Little Tigers + demo team) get "multi-program
   interference"; promotion is time-in-rank only. KoryoGraph: isolated progression tracks per program,
   competency + attendance + time requirements, per-program curricula.
3. **AI bolted on, if at all.** Spark's automations ship with "grammatical errors"; nothing is predictive.
   KoryoGraph: churn prediction, post-class action boards from audio, curriculum generation, natural-language
   reporting, document intake, parent-facing progress narratives — each with a human approval gate.
4. **Pricing tiers that gate retention features.** KoryoGraph gates by module, not by holding features
   hostage; AI is metered, not tiered.

**What "better" must mean in the demo:** everything Spark does for daily operations works (Appendix A), it is
faster to use (kiosk check-in in 2 taps, class roster in 1), and it does five things Spark cannot (§6).

## 2.2 Personas and jobs-to-be-done

| Persona | Surface | Jobs |
|---|---|---|
| **Owner / Head Instructor (Alex)** | Desk (+Mat) | Know revenue, churn risk, and who's testing this month without asking anyone. Approve AI drafts. Run promotions. Set curriculum. |
| **Front desk / program director** | Desk | Enroll families, take payments, sell gear, run the pipeline, answer parents, manage camps & after-school, chase failed payments. |
| **Instructor** | Mat | Today's classes, roster, attendance in seconds, note skills, flag injuries, see who's eligible, record class audio → approve action board. |
| **Parent / guardian** | Home | See progress in plain language, pay, sign waivers, book/cancel, register for tests and camps, message the school, switch between kids. |
| **Adult / teen student** | Home | Progress, curriculum videos, class booking, technique feedback. |
| **Platform admin (John)** | Desk (platform mode) | Provision tenants, entitlements, AI budgets, impersonate for support, watch platform health. |

## 2.3 Surfaces, modules, and packaging

### Surfaces (deployment)
One Next.js app (`apps/web`) with route groups; subdomain middleware rewrites host → route group:

| Host | Route group | Audience |
|---|---|---|
| `www.koryograph.ai` / `koryograph.ai` | `(public)` → `/` | Marketing, pricing, signup, login |
| `desk.koryograph.ai` | `(desk)` → `/desk/*` | Staff |
| `app.koryograph.ai` | `(mat)` → `/mat/*` | Instructors (tablet) |
| `home.koryograph.ai` | `(home)` → `/home/*` | Members |
| any host + `/kiosk/*` | `(kiosk)` | Front-desk tablet, PIN-locked |

In dev, path prefixes work without DNS (`localhost:3000/desk`). Tenant is resolved from a `tenant` custom
JWT claim (§3.3), not from the host; a tenant-branded custom domain (`portal.ridgelinetkd.com`) is a P2
mapping in `tenant_domains`.

### Modules (licensing) — enforced in data, not by deployment
Entitlements are rows, checked by `requireModule(ctx, 'billing')` on every server action/route and mirrored
in RLS for defense in depth; locked modules render as upgrade prompts (not hidden). AI is metered via
`ai_usage` with per-tenant budgets.

| Module key | Includes | Suggested price* |
|---|---|---|
| `core` (required) | Tenancy, staff & roles, people/households, programs/ranks/curriculum, scheduling, attendance & kiosk, basic messaging (Outbox), standard reports, exports & API | $79/mo |
| `billing` | Membership plans & contracts, invoices, autopay, dunning, POS-less payments, Home wallet, accounting export | +$40 |
| `retail` | Products/variants/inventory, POS with Stripe Terminal, cash drawer, purchase orders/receiving | +$30 |
| `grow` | Lead pipeline, trials, automations/workflows, campaigns (email/SMS), landing pages & booking widget, referrals, reviews | +$40 |
| `programs_plus` | Events, camps, after-school (pickup manifests, daily check-in/out), birthday parties, private lessons | +$30 |
| `home` | Parent/student app: booking, wallet, progress, documents, messaging, pro shop | +$30 |
| `intelligence` | All AI agents (§2.5): copilot, drift detector, action board, curriculum builder, doc intake, NL reports, billing recovery, parent narratives | +$49 + metered credits |
| `vision` (add-on) | Technique video feedback | +$29 + credits |
| `multi_location` (add-on) | Locations, cross-location rollups, per-location staff scoping | +$49/location |

Bundles: **Studio** = core+billing+home ($149) · **Academy** = all non-AI ($249) · **Academy AI** = everything
($299 + credits). *Prices are placeholders for Alex's input; the landing page is data-driven from `plans`.

### Roles (defaults per tenant; admin-editable)
`owner`, `admin`, `front_desk`, `instructor`, `assistant_instructor`, `parent`, `student`, plus custom roles
composed from the permission catalogue (§4.2). Platform role `platform_admin` is global.

## 2.4 Feature specification by domain

Priority: **P0** = required for the Alex demo (§6); **P1** = Spark parity, build after all P0; **P2** =
stretch, spec'd so it isn't forgotten. Each bullet is a requirement; the milestone tasks in §5 reference these
by id (e.g. `F5.3`). "AC" = acceptance criterion.

### F1 Platform & tenancy — `core`
- F1.1 **P0** Tenant = one school business. Fields: name, slug, timezone, currency, locale, branding (logo,
  accent color, theme), terminology overrides (`dojang|dojo|academy`, `belt|sash|rank`, `poomsae|kata|form`).
- F1.2 **P0** Locations (≥1 per tenant); classes, staff, inventory, and events are location-scoped.
- F1.3 **P0** Self-serve signup on Public creates tenant + owner + default roles/programs in one transaction.
  AC: e2e `signup.spec` creates a tenant and lands on Desk onboarding.
- F1.4 **P0** Onboarding checklist (add location → programs/ranks → schedule → import/add students → connect
  Stripe → invite staff) with progress persisted.
- F1.5 **P0** Entitlements: `modules`, `plans`, `plan_modules`, `tenant_entitlements`; `requireModule()`.
  AC: db test proves a `core`-only tenant gets 403 on a `billing` action.
- F1.6 **P0** Audit log: every mutation through server actions writes `audit_events` (actor, tenant, entity,
  before/after JSON diff). Desk → Settings → Audit log, filterable.
- F1.7 **P0** Export: any Desk list → CSV; Settings → Data export → full tenant ZIP (JSON per table).
- F1.8 **P1** Public API: API keys per tenant, read endpoints for people, attendance, invoices; webhooks
  (`member.created`, `attendance.recorded`, `invoice.paid`) with signed payloads and retry.
- F1.9 **P1** Multi-location rollup reports; per-location staff scoping (`multi_location`).
- F1.10 **P2** Custom domains per tenant.

### F2 Identity, access, households — `core`
- F2.1 **P0** Supabase Auth: email+password, magic link, Google OAuth. Password reset. Session shared across
  subdomains (cookie domain). `getUser()` (verified) on every server request; never `getSession()` for authz.
- F2.2 **P0** Custom access-token hook injects `tenant_id`, `role`, `permissions[]` claims; tenant switcher
  for users in multiple tenants (rare) updates `active_tenant_id` and refreshes.
- F2.3 **P0** RBAC: permission catalogue (`people.read`, `billing.charge`, `attendance.write`, …), default
  roles, custom roles editable in Desk → Settings → Roles (checkbox grid). AC: db test matrix.
- F2.4 **P0** Staff invitations by email with role; accept → account linked to tenant.
- F2.5 **P0** Households: a billing/communication unit with guardians and students; a person can belong to
  multiple households (split families); primary payer; sibling relationships derived.
- F2.6 **P0** People without logins are normal (children). Guardian login is optional and created by
  invitation or self-claim via emailed link.
- F2.7 **P0** COPPA: guardian consent record per minor (media release, AI processing, messaging), shown and
  enforced in Mat/Home features that touch minors' media.
- F2.8 **P1** Platform admin impersonation ("view as tenant") with banner + audit entry.
- F2.9 **P1** 2FA (TOTP) for staff; passkeys P2.

### F3 CRM & member lifecycle — `core` (pipeline in `grow`)
- F3.1 **P0** `people` is the single human record: type flags (student, guardian, staff, lead), contact info,
  DOB, photo, emergency contacts, medical/allergy/injury notes (restricted permission), tags, custom fields.
- F3.2 **P0** Lifecycle status per student: `lead → trial → active → on_hold → cancelled → alumni`, with
  transition reasons and dates; status drives billing and roster visibility.
- F3.3 **P0** Member profile page (Desk): 360° view — household, memberships, invoices, attendance sparkline,
  rank history, skills, documents, messages, notes/timeline, AI insights panel.
- F3.4 **P0** Lead capture: Public site form + Desk manual add; source & UTM attribution; duplicate detection
  by email/phone.
- F3.5 **P0** Pipeline board (`grow`): kanban `new → contacted → trial_scheduled → trial_attended → offer →
  won/lost`; drag-drop; tasks & reminders; next-action due.
- F3.6 **P0** Trials: intro offers (e.g., 2 free classes / $29 two-week trial), trial booking into real
  classes, trial-to-member conversion in one action (creates household, membership, invoice).
- F3.7 **P1** Referral program: referral codes per household, credit on conversion.
- F3.8 **P1** Birthdays/anniversaries/milestones (100th class) feed automations.
- F3.9 **P1** Notes with @mentions, tasks assigned to staff, front-desk task queue.

### F4 Programs, curriculum, rank — `core`
- F4.1 **P0** Programs (e.g., Little Tigers 4–6, Youth Taekwondo, Adult Taekwondo, Sparring Team, Demo Team,
  Hapkido) each with an isolated **rank ladder** (ordered ranks with belt color/name, stripes/tips count).
- F4.2 **P0** Requirements per rank: minimum classes since last promotion, minimum days since last promotion,
  required skills (competency sign-offs), optional instructor approval, testing fee. Evaluated by the
  **eligibility engine** (pure function, unit-tested) → `eligible | almost (with gaps) | not_yet`.
- F4.3 **P0** Curriculum library: skills/techniques (kicks, forms/poomsae, one-steps, self-defense, sparring
  drills, breaking, terminology) with description, video URL, rubric; mapped to ranks per program.
- F4.4 **P0** Student progression: enrollment in ≥1 program, current rank, stripes, promotion history,
  skill sign-offs with date/instructor/notes.
- F4.5 **P0** Lesson plans: per class instance or template; sections (warm-up, technique, forms, sparring,
  cool-down) referencing curriculum items; instructor view on Mat.
- F4.6 **P1** Uniform/belt sizes on the student record (feeds retail).
- F4.7 **P2** Demo-team choreography timeline (formation notes synced to audio timestamps).

### F5 Scheduling & attendance — `core`
- F5.1 **P0** Class templates with **recurrence rules** (RRULE), location, room, program(s), rank range,
  age range, capacity, instructor(s), duration; exceptions (cancel/modify single occurrence, holidays).
  Materialized `class_sessions` for a rolling window (job).
- F5.2 **P0** Calendar views (Desk week/day; Mat today; Home upcoming) with filters.
- F5.3 **P0** Attendance: Mat roster tap-to-check-in (optimistic, offline-tolerant queue), Desk manual,
  **kiosk** (tablet: search by name → tap → PIN or photo confirm; family check-in), Home self check-in
  when enabled (geofence P2). Source recorded.
- F5.4 **P0** Booking/reservations for capacity-limited classes; waitlist with auto-promote + notify;
  cancellation window; no-show tracking.
- F5.5 **P0** Attendance rules per membership: classes/week limit, allowed programs, makeup credits earned on
  excused absence, expiry.
- F5.6 **P0** Attendance analytics: streaks, last-attended, 30-day velocity (feeds drift detector), class
  utilization.
- F5.7 **P1** Private lessons: instructor availability, booking, pricing.
- F5.8 **P1** Substitute instructor assignment; instructor class count (feeds payroll).
- F5.9 **P1** Class packs / punch cards / drop-ins.
- F5.10 **P2** Door access / QR scan check-in.

### F6 Testing & promotion — `core`
- F6.1 **P0** Testing events: date, location, programs, fee, registration deadline, capacity, judges.
- F6.2 **P0** Auto-roster from eligibility engine; "almost" list with gaps; invite → Home registration +
  fee → confirmed roster; manual override with reason.
- F6.3 **P0** Scoresheets: per-student per-judge scores on rubric items; result `pass | conditional | fail`;
  bulk promote → new rank, stripes reset, certificate generated (PDF), rank history entry, congratulation
  message queued (needs approval if AI-drafted).
- F6.4 **P0** Stripes/tips awarded from Mat with one tap; shows on Home immediately.
- F6.5 **P1** Registry export: Kukkiwon-format CSV (name EN/KR, nationality, DOB, address, current poom/dan,
  test date, instructor, photo path) and generic CSV; Tcon ID stored on the student.
- F6.6 **P1** Certificates: tenant-branded template, signature image, printable batch PDF.
- F6.7 **P2** Belt-inventory reservation on promotion (retail hook).

### F7 Billing & payments — `billing`
- F7.1 **P0** **Ledger-first**: plans, memberships, invoices, invoice lines, payments, allocations, credits,
  refunds live in our DB; Stripe is the processor (Customer, PaymentMethod, PaymentIntent, Terminal). All
  math in `packages/billing` pure functions, unit-tested.
- F7.2 **P0** Membership plans: recurring (weekly/monthly/annual), paid-in-full, contracts (term, auto-renew,
  early-termination fee), drop-in, class packs; program access & attendance rules; enrollment fee; taxes.
- F7.3 **P0** Household billing: one payer, multiple students; **family discounts** (2nd child −X%, 3rd
  free), coupons/promo codes, manual adjustments with reason.
- F7.4 **P0** Autopay: vaulted cards/ACH via Stripe (SetupIntent), billing day, proration on start/upgrade,
  freezes/holds (with fee or not), cancellation with notice period; all produce invoices deterministically
  from a **billing run** (job, idempotent).
- F7.5 **P0** Dunning: failed payment → retry schedule (day 1/3/7) → notices (email/SMS via automations, AI
  tone optional) → status `past_due` → `suspended`; card-update link (Stripe hosted or Home wallet).
- F7.6 **P0** Desk: AR dashboard (aging buckets), invoice list/detail, take payment (card on file, new card,
  cash, check, external), partial payments, refunds (full/partial, to original method), credits.
- F7.7 **P0** Home wallet: payment methods, pay invoice, autopay toggle, receipts, billing history.
- F7.8 **P0** Stripe webhooks (`payment_intent.*`, `setup_intent.*`, `charge.refunded`, `customer.*`) with
  signature verification and idempotency table; Stripe Connect **Standard** accounts per tenant (platform
  fee configurable) — platform-level Stripe keys, tenant connects via onboarding link.
- F7.9 **P1** Accounting export (QuickBooks/Xero-compatible CSV: invoices, payments, refunds, by GL class).
- F7.10 **P1** Revenue reports: MRR, ARR, deferred revenue for paid-in-full, churn MRR, LTV.
- F7.11 **P2** Surcharges/convenience fees by jurisdiction; sales tax by location rate table.

### F8 Retail, POS, inventory — `retail`
- F8.1 **P0** Products with variants (size/color), SKU, barcode, price, cost, tax class, images; categories
  (uniforms, sparring gear, belts, weapons, apparel, consumables).
- F8.2 **P0** Inventory per location: on-hand, reserved, reorder point, adjustments with reason, movement
  ledger.
- F8.3 **P0** POS screen (Desk, tablet-friendly): search/scan, cart, attach to household, discounts, tenders
  (card via Stripe Terminal or card-on-file, cash with drawer, check, account credit, split), receipt
  (print/email), returns/exchanges.
- F8.4 **P0** Gear packages bundled into memberships (enrollment kit) → fulfilment task with sizes.
- F8.5 **P1** Purchase orders, receiving (manual + AI packing-slip intake), supplier records, COGS/margin
  report.
- F8.6 **P1** Home pro shop: browse, order for pickup, pay.
- F8.7 **P2** Barcode label printing.

### F9 Events, camps, after-school, parties — `programs_plus`
- F9.1 **P0** Events: tournaments, seminars, parents' night out, belt ceremonies; pricing tiers, capacity,
  waivers required, registration (Desk + Home), roster, check-in.
- F9.2 **P0** Camps: multi-day sessions, per-day or per-week pricing, daily roster, daily check-in/out with
  guardian signature, authorized pickups, lunch/allergy flags.
- F9.3 **P1** After-school: enrolled roster, school pickup manifest by school/route, daily attendance with
  time in/out, absence alerts to guardians, weekly billing cycle.
- F9.4 **P1** Birthday parties: package, deposit, host, waiver collection link for guests.
- F9.5 **P1** Private lessons (shares F5.7).

### F10 Communications — `core` (broadcast/automation in `grow`)
- F10.1 **P0** Provider abstraction: email (Resend), SMS (Twilio), push (web push P1). No key → **Outbox**
  (messages stored with status `unsent_no_provider`, viewable in Desk). Every send logged in
  `communications` with delivery status via webhooks.
- F10.2 **P0** Transactional templates (invite, receipt, failed payment, test invitation, class cancelled,
  waitlist promoted, welcome) with merge fields, per-tenant overrides, preview.
- F10.3 **P0** Messaging: two-way threads between household and school (Home ↔ Desk inbox), instructor
  broadcast to a class roster, read receipts. Inbound SMS/email replies attach to threads (webhooks).
- F10.4 **P0** Consent: email/SMS opt-in per person, TCPA quiet hours per tenant timezone, STOP handling.
- F10.5 **P0** Automations (`grow`): trigger (status change, absence ≥N days, birthday, failed payment, lead
  stage, test scheduled, membership expiring) → conditions → actions (email/SMS/task/tag/wait) with
  per-run log; 8 shipped templates; visual list editor (not a canvas).
- F10.6 **P1** Broadcasts: segment builder (program, rank, status, tags, last-attended) → email/SMS campaign
  with stats; drip sequences.
- F10.7 **P1** Push notifications to Home (web push).

### F11 Marketing & growth — `grow`
- F11.1 **P0** Public lead form and trial booking widget (embeddable iframe/script) → lead + trial booking.
- F11.2 **P1** Landing page builder: templates for offers (block-based), tenant-branded, hosted on
  `koryograph.ai/s/<slug>` or custom domain.
- F11.3 **P1** Review requests (Google) after milestones; referral links; UTM attribution report.

### F12 Documents & compliance — `core`
- F12.1 **P0** Waivers/agreements: versioned templates (rich text + merge fields), required-by (program,
  event, membership), e-sign in Home/kiosk with typed name + IP + timestamp + PDF snapshot; **re-sign on new
  version**; guardian signs for minors.
- F12.2 **P0** Document vault per person/household (uploads: medical forms, photos, certificates) in
  Supabase Storage with tenant-scoped policies.
- F12.3 **P0** Compliance dashboard: unsigned required documents, expired certifications, missing consents.
- F12.4 **P1** Contract e-sign for memberships (F7.2 contracts).

### F13 Staff operations — `core`
- F13.1 **P0** Staff profiles: roles, programs they teach, certifications with expiry (instructor rank,
  CPR/first aid, background check), pay rates.
- F13.2 **P1** Time clock (kiosk/Desk), shifts, per-class instructor pay & session counts, commissions on
  memberships/retail sold, payroll export CSV.
- F13.3 **P1** Tasks: assignable, due dates, front-desk queue, auto-created by automations.
- F13.4 **P2** Instructor scorecards (retention of their classes, evaluation throughput).

### F14 Reporting & BI — `core` (NL reports in `intelligence`)
- F14.1 **P0** Owner dashboard: active students, MRR, AR past-due, attendance this week vs last, churn risk
  count, trials in pipeline, upcoming tests, low stock — all live queries with drill-through.
- F14.2 **P0** Report library (each a SQL view + typed query + table/chart + CSV export): membership roster,
  attendance by class/period, retention cohorts, churn list, revenue by category, AR aging, payments,
  refunds, trial conversion funnel, testing eligibility, inventory valuation, staff sessions.
- F14.3 **P1** Saved filters, scheduled email delivery, KPI targets with variance.
- F14.4 **P1** Custom report builder (pick entity → columns → filters → group) over a whitelisted schema.

### F15 Member & parent experience — `home`
- F15.1 **P0** Family switcher (guardian ↔ each child), child-safe profile views.
- F15.2 **P0** Progress: current rank/stripes, requirements progress bars, skill sign-offs, next test
  eligibility, rank history, attendance calendar & streak, curriculum videos for current rank.
- F15.3 **P0** Schedule: upcoming classes, book/cancel, waitlist, makeup credits, events & camps
  registration, test registration + fee.
- F15.4 **P0** Wallet & billing (F7.7). Documents to sign (F12.1). Messages (F10.3). Notifications center.
- F15.5 **P1** Pro shop (F8.6), technique video upload for feedback (`vision`), referral sharing.
- F15.6 **P1** Installable PWA (manifest, offline shell, push).

### F16 The AI layer — `intelligence` / `vision` — see §2.5

### F17 Platform services — `core`
- F17.1 **P0** Jobs: `jobs` + `job_runs` tables; scheduled route handlers (`/api/jobs/<name>`, `CRON_SECRET`)
  triggered by Vercel Cron in prod and `npm run jobs:tick` in dev; idempotent; nightly: materialize sessions,
  billing run, dunning, drift scoring, digest emails; every 5 min: outbox dispatch, webhook retries.
- F17.2 **P0** Feature flags per tenant (`tenant_settings.flags`), rate limiting on public endpoints, request
  ids in logs, health endpoint.
- F17.3 **P0** Observability: pino → stdout; error boundary pages; Sentry-compatible hook (env-gated).
- F17.4 **P1** Backups: documented Supabase PITR; export job nightly to Storage (tenant ZIP).

## 2.5 The AI layer

**Principles.** (1) Every AI feature has a manual path; the platform is fully usable with AI disabled.
(2) Agents **draft**, humans **approve** — anything that reaches a customer or changes money/rank goes through
`approval_items`. (3) Every run is logged to `ai_runs` (task, model, tokens, cost, latency, input hash) and
metered against the tenant's monthly budget; over budget → feature shows "AI budget reached" and the manual
path. (4) Model choice is configuration (task → model tier) via OpenRouter, retunable without deploys.
(5) Structured outputs everywhere: each task has a zod schema; responses are validated; invalid → retry once
with the error → then fail loudly. (6) Minors' media requires consent (F2.7).

### Agent catalogue (id · trigger · inputs · tier · output → destination · approval)

| Id | Agent | Trigger | Inputs | Tier | Output → destination | Approval |
|---|---|---|---|---|---|---|
| A1 | **Desk Copilot** (RAG) | staff chat | question + retrieved chunks (policies, curriculum, FAQs, schedule) + tool calls (`find_person`, `get_invoices`, `attendance_summary`, `run_report`) | frontier | answer with citations; tool results | none (read-only tools); write tools propose an `approval_item` |
| A2 | **Home Assistant** ("Dojang Bot") | parent/student chat | question + tenant knowledge base only (no other members' data), household context | fast | answer with citations or "ask the front desk" (creates message thread) | none |
| A3 | **Drift Detector** | nightly job | 90-day attendance, membership status, payments, tenure, recent notes → rule-based risk score (pure TS) + LLM explanation & draft outreach | fast | `risk_scores` + draft SMS/email → `approval_items` | **required** |
| A4 | **Post-class Action Board** | instructor uploads class audio (Mat) | audio → transcription (OpenRouter audio-capable model) → NER against roster → attendance confirmations, skill notes, injury flags, follow-ups | frontier (transcribe: audio tier) | draft `attendance`, `skill_signoffs`, `notes` → Action Board UI | **required** (Approve all / edit) |
| A5 | **Curriculum & Lesson Builder** | instructor prompt ("12-week sparring block for green–blue belts") | program, ranks, skill library, class schedule | frontier | lesson plan drafts linked to skills → editable in Mat/Desk | instructor saves = approval |
| A6 | **Document Intake** | upload packing slip / invoice / competitor export | image/PDF → vision extraction | vision | draft inventory receipt lines matched to SKUs (fuzzy) / draft import mapping | **required** |
| A7 | **NL Reports** | owner types a question ("revenue vs churn risk by program, last 6 months") | schema whitelist + few-shot | frontier | validated SQL (read-only role, whitelisted views, `EXPLAIN` cost cap) + chart spec `{type, x, y, series}` | none (read-only) |
| A8 | **Billing Recovery** | dunning step | failed payment context, tenure, history | fast | tone-adjusted draft message → `approval_items` (or auto-send if tenant enables "auto after first approval") | required by default |
| A9 | **Parent Narratives** | weekly job / on promotion | attendance, sign-offs, instructor notes | fast | plain-language progress update → Home feed after staff approve (batch approve) | **required** |
| A10 | **Lead Scoring & Next Action** | lead created/updated | source, engagement, form answers | fast | score + suggested next action → pipeline card | none (suggestion) |
| A11 | **Technique Feedback** (`vision`) | student uploads clip | keyframes (ffmpeg) + technique rubric + optional instructor "gold standard" clip keyframes | vision | rubric-scored feedback + 3 tips → instructor review before student sees | **required** |
| A12 | **Smart Schedule Suggestions** | weekly | utilization, waitlists, no-shows | fast | suggestions (add section, merge, move) → Desk insights | none |

### Approval queue (Desk → Inbox → Approvals)
One screen for all `approval_items`: type, preview, edit-in-place, approve/reject/reason, bulk actions,
who/when. Approval executes the deferred action (send message, write attendance, post narrative). Rejections
feed a `feedback` column used as few-shot negatives.

### Knowledge base (RAG)
`kb_documents` (policies, FAQs, curriculum text, schedule digest auto-generated nightly) → chunked →
`kb_chunks.embedding vector(1536)` (embedding model via OpenRouter) → hybrid search (pgvector cosine +
`tsvector`). Tenant-scoped by RLS. Desk → Settings → Knowledge base to add/edit/re-index.

### Testing AI without spending money
`packages/ai` has a transport interface: `live` (OpenRouter) and `fixture` (JSON by task id +
input hash, recorded once with `npm run ai:record`). Unit/e2e use `fixture`. `AI_TRANSPORT=fixture` is
refused when `NODE_ENV=production`. A small live eval (`npm run ai:eval`) runs each task once against
OpenRouter and checks schema validity — part of the M4 gate when a key exists (else HANDOFF).

## 2.6 Non-functional requirements

- **Security:** RLS on every table (guard test); service role confined to `src/server/admin/**`, jobs,
  webhooks; CSRF-safe server actions; input validation with zod at every boundary; secrets only server-side;
  Stripe webhook signature verification; rate limiting on public/kiosk routes; PIN lockout on kiosk.
- **Privacy/compliance:** COPPA consent records; PCI SAQ-A posture (no PAN touches our servers — Stripe
  Elements/Terminal only); TCPA consent + quiet hours; data export & deletion request flow (P1).
- **Performance budgets:** Desk list pages < 1.5 s TTI on seed data; Mat roster < 800 ms; kiosk search
  < 150 ms server time; N+1 forbidden (use views/joins).
- **Reliability:** idempotent jobs and webhooks; optimistic UI with retry queue for Mat attendance;
  graceful degradation when AI/comms providers are down.
- **Accessibility:** WCAG 2.2 AA targets; Playwright + axe checks on the top 15 routes (M5).
- **Portability:** Postgres-only features; migrations are plain SQL; full export; API. No Supabase-specific
  logic outside `packages/db` and auth.
- **Observability:** structured logs, request ids, job run history, webhook delivery log, AI run log.

---

# §3 Technical architecture

## 3.1 Stack (pinned)

| Concern | Choice (version) |
|---|---|
| Monorepo | Turborepo 2.9 + npm workspaces (existing) |
| App | Next.js **16.3.5** (App Router, RSC, server actions), React **19.3.0**, TypeScript **5.9** |
| Styling | Tailwind CSS **4.3.3** (`@tailwindcss/postcss`), shadcn/ui (via `npx shadcn@latest`), Radix, `lucide-react` 1.47, `class-variance-authority` 0.7.1, `tailwind-merge` 3.7, `sonner` 2.0.8, `cmdk` 1.1.1 |
| Data | Supabase (Postgres 15/16 + Auth + Storage), `@supabase/supabase-js` ^2.45, `@supabase/ssr` ^0.5, generated types via `supabase gen types` |
| Complex queries | SQL views + Postgres functions (RPC) in migrations; `postgres` (porsager) client for jobs/reports under service role where supabase-js is awkward |
| Validation | zod **4.6.5**, `react-hook-form` 7.88, `@hookform/resolvers` 5.9 |
| Payments | `stripe` **22.6.2** (Connect Standard, PaymentIntents, SetupIntents, Terminal), `@stripe/stripe-js`, `@stripe/react-stripe-js`; `stripe-mock` for unit tests |
| AI | `openai` **7.20.0** SDK pointed at `https://openrouter.ai/api/v1`; `pdf-lib` 1.17 for certificates; ffmpeg for keyframes |
| Comms | `resend` 6.28, `twilio` 6.1, `@react-email/components` 1.0 |
| Scheduling | `rrule` 2.8.1, `date-fns` 4.4 |
| Tables/DnD/charts | `@tanstack/react-table`, `@dnd-kit/core` 6.3.1, `recharts` 3.10 |
| Misc | `nuqs` 2.10 (URL state), `papaparse` 5.7 (CSV), `qrcode` 1.5.4, `@faker-js/faker` 10.6 + `seedrandom` 3.0.5 (seed), `pino` 10.3, `tsx` 4.23 |
| Tests | `vitest` **5.0.1**, `@playwright/test` **1.63.0**, `@axe-core/playwright` |
| Fonts | `@fontsource-variable/inter` 5.3, `@fontsource-variable/space-grotesk` 5.3 (self-hosted) |

## 3.2 Repository layout (target)

```
apps/web/                       # the single Next.js app
  src/app/(public)/             # / , /pricing, /signup, /login, /s/[slug] landing pages, /widget
  src/app/(desk)/desk/          # staff surface
  src/app/(mat)/mat/            # instructor surface (tablet)
  src/app/(home)/home/          # member surface
  src/app/(kiosk)/kiosk/        # PIN-locked check-in tablet
  src/app/api/                  # route handlers: auth callback, stripe webhooks, jobs, public API, widget
  src/server/                   # server-only: actions/, queries/, admin/, jobs/, auth/, context.ts
  src/components/               # app components (feature folders)
  src/lib/                      # client-safe utils
  middleware.ts                 # host→route-group rewrite, session refresh, surface auth guard
packages/ui/                    # shadcn-based component kit + tokens.css + themes
packages/db/                    # supabase clients, generated Database types, typed query helpers, RLS ctx
packages/billing/               # pure billing engine (plans, proration, discounts, dunning schedule)
packages/eligibility/           # pure rank-eligibility engine
packages/ai/                    # OpenRouter gateway, task registry, transports, schemas, RAG helpers
packages/comms/                 # provider interfaces (email/sms/push), templates, outbox
packages/config/                # eslint, tsconfig, tailwind preset (renamed from existing)
supabase/
  config.toml
  migrations/0001_*.sql …       # the only schema source of truth
  seed.sql                      # minimal reference data (permissions, modules, plans)
  functions/                    # (optional) edge functions — not used in v1
scripts/seed/                   # TypeScript seed of the demo tenant (Appendix C)
tests/db/                       # vitest: migrations apply, RLS matrix, guard tests, RPC tests
tests/e2e/                      # Playwright specs by surface + the demo script
docs/build/                     # PROGRESS.md, DECISIONS.md, FINAL-REPORT.md
docs/archive/                   # superseded docs
CLAUDE.md                       # short: how to run, test, gate; points here
```

## 3.3 Auth and tenancy

- **Supabase Auth** with `@supabase/ssr`. Server: `createServerClient` with cookie adapter using
  `getAll/setAll` (correctly, per the 0.5 API). Browser: `createBrowserClient` with `cookieOptions.domain`
  = `NEXT_PUBLIC_COOKIE_DOMAIN` so sessions span subdomains. **Always** authorize via `supabase.auth.getUser()`.
- **Tenant membership**: `tenant_users(tenant_id, user_id, role_id, status)`. `profiles.active_tenant_id`.
- **Custom access token hook** (Postgres function `auth_hook.custom_access_token`, registered in
  `config.toml` / dashboard): adds `app_metadata.tenant_id`, `app_metadata.role`,
  `app_metadata.permissions` (string[]), `app_metadata.modules` (string[]) from `tenant_users`, `roles`,
  `tenant_entitlements`. Switching tenant updates `active_tenant_id` and calls `refreshSession()`.
- **Request context** (`src/server/context.ts`): `getCtx()` → `{ user, tenantId, role, permissions,
  modules, tz }` from the verified JWT; `requirePermission(ctx, 'billing.charge')`,
  `requireModule(ctx, 'billing')`, `requireSurface(ctx, 'mat')`. Every server action starts with these.
- **Middleware**: refresh session; map host → route group; redirect unauthenticated users on
  `/desk|/mat|/home` to `/login?next=`; block `/desk` for roles without `desk.access`; `/kiosk` requires a
  kiosk device token cookie set by a staff member once per device.
- **Platform admin**: `platform_admins(user_id)`; `platform_admin` claim; `/desk/platform/*` routes.

## 3.4 RLS and data access

- Helper SQL functions (schema `app`): `app.tenant_id()` = `(auth.jwt()->'app_metadata'->>'tenant_id')::uuid`;
  `app.has_permission(text)`; `app.has_module(text)`; `app.user_id()` = `auth.uid()`;
  `app.is_platform_admin()`.
- **Policy template** applied to every tenant-scoped table:
  `select`: `tenant_id = app.tenant_id()`;
  `insert/update/delete`: `tenant_id = app.tenant_id() and app.has_permission('<domain>.write')`.
  Member self-access policies (Home) are additive: e.g. `people` readable where the row is in the user's
  household (`app.household_ids()`), `invoices` where `household_id = any(app.household_ids())`.
- **Service role** bypasses RLS: used only in `src/server/admin/**`, `src/app/api/(stripe|jobs|webhooks)`.
- Storage buckets: `tenant-media` (path `<tenant_id>/…`) with policies mirroring `app.tenant_id()`.
- **Guard tests** (`tests/db/guards.test.ts`): (a) every table in `public` has RLS enabled; (b) every RLS
  table has ≥1 policy; (c) every table with a `tenant_id` column has ≥1 policy whose expression contains
  `app.tenant_id()`; (d) `tenant_id` is `not null` on every tenant-scoped table; (e) every FK has an index.
- **RLS matrix test** (`tests/db/rls-matrix.test.ts`): two seeded tenants, users of each role; for every
  tenant-scoped table assert cross-tenant `select` returns 0 rows and cross-tenant `insert` is rejected.
- Queries: typed helpers in `packages/db/src/queries/<domain>.ts` returning `Database['public']['Views'|'Tables']`
  types; list pages use views (`v_member_roster`, `v_ar_aging`, …) to avoid N+1.

## 3.5 Payments architecture

- `packages/billing`: `computeInvoice(plan, membership, period, discounts)`, `prorate()`, `applyFamilyDiscount()`,
  `dunningSchedule(policy, failureCount)`, `allocatePayment()`. 100% unit-tested with table-driven cases.
- Stripe Connect Standard: platform keys in env; each tenant has `stripe_account_id`; requests use
  `stripeAccount` header. Money flows to the tenant's account; optional `application_fee_amount`.
- Flows: vault card (SetupIntent → `payment_methods`), charge invoice (PaymentIntent with
  `off_session` for autopay), Terminal (connection token, `PaymentIntent` capture), refunds, Connect
  onboarding link. Every Stripe object id stored on our ledger rows; every webhook stored in
  `stripe_events` (idempotent by event id) and processed by a handler that updates ledger state.
- Dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Tests: `stripe-mock` on :12111 for
  SDK-level unit tests; fixture webhook events for handler tests; Playwright uses Stripe test cards.

## 3.6 AI gateway (`packages/ai`)

- `createAi({ transport })` → `runTask(taskId, input, ctx)`. Task registry entries:
  `{ id, tier: 'fast'|'frontier'|'vision'|'audio'|'embed', schema: zod, buildMessages(input), maxCost }`.
- Model routing table (env-overridable, defaults chosen at M4.01 from OpenRouter's catalogue; document the
  picks in DECISIONS.md): `fast`, `frontier`, `vision`, `audio`, `embed`.
- Uses `openai` SDK: `new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey, defaultHeaders: {
  'HTTP-Referer', 'X-Title' } })`; `response_format: { type: 'json_schema', json_schema }` where supported;
  `tools` for A1; images/audio as content parts.
- Logs `ai_runs`; enforces `tenant_ai_budgets`; approval items via `packages/ai/approvals.ts`.
- Transports: `live`, `fixture` (`tests/fixtures/ai/<taskId>/<inputHash>.json`).

## 3.7 Communications (`packages/comms`)

`send({ tenantId, channel, to, template, data })` → renders (react-email for email; text for SMS) → provider
or Outbox → `communications` row. Delivery webhooks update status. Consent + quiet-hours checks happen here,
not in callers. Inbound webhooks (Twilio SMS, Resend inbound) create/append `message_threads`.

## 3.8 Jobs

`src/server/jobs/<name>.ts` exporting `run(ctxServiceRole)`; registered in `jobs` table with schedule;
`/api/jobs/[name]` (POST, `Authorization: Bearer $CRON_SECRET`) executes with a `job_runs` row (started,
finished, status, stats, error). `vercel.json` crons in prod; `npm run jobs:tick` runs all due jobs locally;
Playwright calls specific jobs directly where a test needs them (e.g. billing run).

## 3.9 Testing strategy and gates

| Layer | Tool | What |
|---|---|---|
| Unit | vitest | `packages/*` pure engines, utils, zod schemas, template rendering |
| DB | vitest + supabase local | migrations apply cleanly from zero; guard tests; RLS matrix; RPC/view correctness on seed |
| Integration | vitest | server actions with a test user session (using `supabase.auth.admin` to mint sessions); Stripe handlers with fixtures; comms outbox |
| E2E | Playwright | per-surface specs; the demo script; axe on key routes |
| Static | tsc, eslint (incl. `no-restricted-syntax` for `MOCK_`, `placeholder-id`, `dangerouslySetInnerHTML`) | every commit |

`npm run check` = typecheck + lint + unit. `npm run test:db`, `npm run test:e2e`. `npm run gate -- mN`
(Appendix B) runs all of them cumulatively with the blocked-task exclusion mechanism.

## 3.10 Design system

- Port `packages/ui/src/globals.css` tokens into `packages/ui/src/styles/tokens.css` keeping the five
  themes as `[data-theme]` blocks; map to Tailwind 4 `@theme` variables (`--color-bg-base` …) so utilities
  like `bg-surface`, `text-muted`, `border-default`, `bg-accent` exist. Default theme `koryo-red`
  (crimson `#e11d48` on near-black `#09090b`); `light` for Home by default (parents in daylight), user
  switchable; persist per user in `profiles.preferred_theme`.
- Fonts: Inter (body), Space Grotesk (display/numbers) self-hosted.
- Components (shadcn via CLI): button, input, textarea, select, checkbox, radio, switch, dialog, sheet,
  drawer, dropdown-menu, popover, tabs, table, badge, avatar, card, toast (sonner), command (cmdk), calendar,
  form, skeleton, tooltip, separator, scroll-area, data-table (tanstack). App-level: `PageHeader`,
  `StatCard`, `EmptyState` (with the honest copy), `ApprovalCard`, `PersonChip`, `RankBadge`, `MoneyText`,
  `DateText`, `KioskKeypad`.
- Layouts: Desk = left nav + top bar (command palette ⌘K, tenant switcher, approvals badge); Mat = bottom
  tab bar, large touch targets (≥48px), today-first; Home = mobile app feel, bottom tabs, family switcher
  in header; Kiosk = full-screen, no chrome.

---

# §4 Data model (target schema)

**Conventions** (applied to every table unless noted): `id uuid pk default gen_random_uuid()`;
tenant-scoped tables have `tenant_id uuid not null references tenants(id) on delete cascade`;
`created_at timestamptz not null default now()`, `updated_at` (trigger `app.set_updated_at()`);
soft delete via `archived_at timestamptz null` where listed; money as `*_cents integer` + `currency char(3)`;
enums as `text` + `check (… in (…))` (simpler migrations than Postgres enums); every FK indexed; JSON as
`jsonb`. RLS per §3.4 on every table below; tables marked **[global]** are platform-level (no `tenant_id`,
platform-admin write, public/authenticated read as noted). Column lists show domain columns only.

## 4.1 Platform & tenancy
- **tenants** [global-ish; row readable by its members] — `name, slug unique, timezone, currency, locale, branding jsonb {logo_url, accent, theme}, terminology jsonb, stripe_account_id, stripe_onboarding_complete bool, status (active|suspended|trial), trial_ends_at, onboarding jsonb {steps…}, settings jsonb {flags, quiet_hours, kiosk…}`
- **locations** — `name, address jsonb, phone, timezone, is_default bool, rooms jsonb[], archived_at`
- **tenant_domains** — `host unique, verified_at` (P2)
- **modules** [global] — `key pk (text), name, description, sort`
- **plans** [global] — `key pk, name, monthly_cents, annual_cents, is_bundle, sort, public bool`
- **plan_modules** [global] — `plan_key fk, module_key fk` pk(plan_key, module_key)
- **tenant_entitlements** — `module_key fk, source (plan|addon|trial|comp), starts_at, ends_at null` unique(tenant_id, module_key)
- **tenant_subscriptions** — `plan_key, status, stripe_customer_id, stripe_subscription_id, current_period_end, seats int` (what tenants pay the platform)
- **audit_events** — `actor_user_id, actor_role, entity_type, entity_id, action (create|update|delete|custom), before jsonb, after jsonb, ip, request_id` (indexed by entity, by created_at)
- **platform_admins** [global] — `user_id pk`
- **api_keys** — `name, key_hash, prefix, scopes text[], last_used_at, revoked_at`
- **webhook_endpoints** — `url, secret, events text[], active bool`; **webhook_deliveries** — `endpoint_id, event, payload jsonb, status, attempts, next_attempt_at, last_error`
- **jobs** [global] — `name pk, schedule (cron text), enabled`; **job_runs** — `job_name, tenant_id null, started_at, finished_at, status, stats jsonb, error`

## 4.2 Identity, access, households
- **profiles** — `id uuid pk references auth.users, email, full_name, avatar_url, phone, preferred_theme, active_tenant_id uuid null, last_seen_at` (no tenant_id; readable by self; RLS by id)
- **permissions** [global] — `key pk, domain, description` (seeded catalogue: `desk.access, mat.access, home.access, people.read, people.write, people.medical.read, attendance.write, curriculum.write, ranks.promote, testing.manage, billing.read, billing.charge, billing.refund, retail.sell, inventory.manage, crm.manage, comms.send, automations.manage, events.manage, staff.manage, roles.manage, settings.manage, reports.read, ai.approve, ai.use, exports.run, audit.read, kiosk.manage`)
- **roles** — `key, name, is_system bool, description` unique(tenant_id, key); **role_permissions** — `role_id, permission_key` pk
- **tenant_users** — `user_id, role_id, status (invited|active|disabled), invited_email, invited_by, accepted_at, location_ids uuid[] null` unique(tenant_id, user_id)
- **staff_invitations** — `email, role_id, token_hash, expires_at, accepted_at`
- **people** — `type_flags text[] (student|guardian|staff|lead), first_name, last_name, preferred_name, dob, gender null, email, phone, phone_sms_consent bool, email_consent bool, photo_path, address jsonb, emergency_contacts jsonb[], medical_notes text (perm people.medical.read), allergies text[], tags text[], custom jsonb, user_id uuid null (linked login), primary_location_id, status (lead|trial|active|on_hold|cancelled|alumni|staff|guardian_only), status_changed_at, status_reason, source, utm jsonb, referred_by_person_id, kukkiwon_id, uniform_size, belt_size, archived_at` (indexes: name trigram, email, phone, status)
- **households** — `name, primary_payer_person_id, stripe_customer_id, billing_email, notes, balance_cents (materialized via trigger)`
- **household_members** — `household_id, person_id, relationship (guardian|student|other), is_primary_guardian, can_pickup bool, receives_billing bool` pk(household_id, person_id)
- **consents** — `person_id (minor), guardian_person_id, kind (media_release|ai_processing|messaging|photo), granted bool, granted_at, method, ip, document_path`
- **kiosk_devices** — `location_id, name, token_hash, last_seen_at, revoked_at`; **person_pins** — `person_id unique, pin_hash, failed_attempts, locked_until`

## 4.3 Programs, curriculum, rank
- **programs** — `name, slug, description, age_min, age_max, color, sort, active bool, terminology jsonb`
- **ranks** — `program_id, name, belt_color, order int, stripes_max int, testing_fee_cents, certificate_template_id null` unique(program_id, order)
- **rank_requirements** — `rank_id (target), min_classes int, min_days int, requires_instructor_approval bool, notes`
- **skills** — `program_id null (shared if null), category (kick|form|one_step|self_defense|sparring|breaking|terminology|conditioning|other), name, description, video_url, rubric jsonb [{criterion, weight}], sort`
- **rank_skills** — `rank_id, skill_id, required bool` pk
- **enrollments** — `person_id, program_id, current_rank_id, stripes int, started_at, last_promoted_at, status (active|paused|ended), classes_since_promotion int (materialized)` unique(person_id, program_id)
- **promotions** — `enrollment_id, from_rank_id null, to_rank_id, promoted_at, testing_event_id null, promoted_by_user_id, certificate_path, notes`
- **stripe_awards** — `enrollment_id, awarded_at, awarded_by_user_id, note` (stripes/tips)
- **skill_signoffs** — `enrollment_id, skill_id, signed_off_at, by_user_id, score numeric null, notes, source (manual|action_board|vision)` unique(enrollment_id, skill_id)
- **lesson_plans** — `program_id null, name, sections jsonb [{title, minutes, skill_ids, notes}], created_by, source (manual|ai), ai_run_id null`
- **certificate_templates** — `name, background_path, layout jsonb, signature_path`

## 4.4 Scheduling & attendance
- **class_templates** — `location_id, name, program_ids uuid[], rank_min_order int null, rank_max_order int null, age_min, age_max, capacity int null, duration_min, rrule text, dtstart timestamptz, until timestamptz null, room, instructor_ids uuid[], color, bookable bool, cancellation_window_min, active bool`
- **class_sessions** — `template_id, location_id, starts_at, ends_at, status (scheduled|cancelled|completed), instructor_ids uuid[], substitute_ids uuid[], capacity, lesson_plan_id null, notes, audio_path null, action_board_status null` unique(template_id, starts_at) (materialized rolling 90 days by job)
- **schedule_exceptions** — `template_id, date, kind (cancel|modify), overrides jsonb, reason`
- **holidays** — `location_id null, date, name`
- **bookings** — `session_id, person_id, status (booked|waitlisted|cancelled|no_show|attended), waitlist_position int null, booked_by_user_id, source, credit_id null` unique(session_id, person_id)
- **attendance** — `session_id, person_id, checked_in_at, checked_in_by_user_id null, source (mat|desk|kiosk|home|action_board|import), note` unique(session_id, person_id)
- **makeup_credits** — `person_id, earned_from_session_id null, reason, expires_at, used_booking_id null`
- **class_packs** — `person_id, membership_id null, total int, used int, expires_at`
- **private_lesson_slots** — `instructor_user_id, location_id, starts_at, ends_at, price_cents, booked_person_id null, status`
- **v_attendance_velocity** (view) — per person: last_attended_at, classes_30d, classes_prev_30d, streak_weeks

## 4.5 Testing & promotion
- **testing_events** — `location_id, name, starts_at, ends_at, program_ids uuid[], fee_cents, registration_deadline, capacity, judges uuid[], status (draft|open|closed|completed), notes`
- **testing_registrations** — `testing_event_id, enrollment_id, status (invited|registered|paid|confirmed|withdrawn|passed|conditional|failed), eligibility_snapshot jsonb, override_reason, invoice_id null, result_notes` unique(testing_event_id, enrollment_id)
- **testing_scores** — `registration_id, judge_user_id, scores jsonb {skill_id: score}, total numeric, comments`

## 4.6 Billing & payments
- **membership_plans** — `name, description, kind (recurring|paid_in_full|contract|drop_in|class_pack|trial), interval (week|month|year) null, interval_count, price_cents, enrollment_fee_cents, contract_months null, early_termination_fee_cents null, auto_renew, program_ids uuid[], attendance_rule jsonb {classes_per_week null, unlimited bool}, family_discount jsonb {second_pct, third_plus_pct}, tax_class, gear_package_product_ids uuid[], public bool, active bool, sort`
- **memberships** — `household_id, person_id, plan_id, status (trial|active|past_due|on_hold|cancelled|expired|pending), starts_at, ends_at null, billing_day int, next_bill_at, hold_from, hold_until, cancel_at, cancel_reason, contract_ends_at, price_override_cents null, discount_ids uuid[], stripe_subscription_id null, notes`
- **discounts** — `code null unique, name, kind (pct|amount), value, applies_to (membership|invoice|retail|event), max_uses, uses, starts_at, ends_at, active`
- **invoices** — `household_id, person_id null, number (per-tenant sequence), status (draft|open|paid|partially_paid|past_due|void|refunded), issued_at, due_at, subtotal_cents, discount_cents, tax_cents, total_cents, paid_cents, balance_cents, currency, source (billing_run|manual|pos|event|testing|enrollment), memo, dunning_state jsonb {attempts, next_attempt_at, stage}, stripe_payment_intent_id null`
- **invoice_lines** — `invoice_id, kind (membership|fee|product|event|testing|adjustment|tax|discount), description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate`
- **payments** — `household_id, invoice_id null, amount_cents, method (card|ach|cash|check|external|credit|terminal), status (pending|succeeded|failed|refunded|partially_refunded), stripe_payment_intent_id, stripe_charge_id, payment_method_id null, received_at, received_by_user_id, failure_code, failure_message, memo`
- **payment_allocations** — `payment_id, invoice_id, amount_cents`
- **refunds** — `payment_id, amount_cents, reason, stripe_refund_id, status, by_user_id`
- **credits** — `household_id, amount_cents, remaining_cents, reason, expires_at, source_ref`
- **payment_methods** — `household_id, stripe_payment_method_id, kind (card|us_bank_account), brand, last4, exp_month, exp_year, is_default, status`
- **billing_runs** — `run_date, status, invoices_created int, amount_cents, errors jsonb, job_run_id`
- **dunning_policies** — `name, steps jsonb [{day, action: retry|email|sms|suspend}], is_default`
- **stripe_events** — `id text pk (evt_…), type, account_id, payload jsonb, processed_at, error` [global]
- **tax_rates** — `location_id null, name, rate numeric, applies_to text[]`
- **v_ar_aging**, **v_mrr** (views)

## 4.7 Retail & inventory
- **products** — `name, category, description, tax_class, images text[], active, sort`
- **product_variants** — `product_id, sku unique per tenant, barcode, options jsonb {size, color}, price_cents, cost_cents, active`
- **inventory_levels** — `variant_id, location_id, on_hand int, reserved int, reorder_point int` unique(variant_id, location_id)
- **inventory_movements** — `variant_id, location_id, delta int, reason (sale|return|receive|adjust|transfer|package), ref_type, ref_id, by_user_id, note`
- **suppliers** — `name, contact jsonb, notes`
- **purchase_orders** — `supplier_id, status (draft|sent|partial|received|cancelled), expected_at, notes, ai_intake_run_id null`; **purchase_order_lines** — `po_id, variant_id, qty_ordered, qty_received, unit_cost_cents`
- **pos_sales** — `location_id, household_id null, person_id null, cashier_user_id, status (open|completed|refunded|void), subtotal_cents, discount_cents, tax_cents, total_cents, invoice_id, receipt_number, terminal_reader_id null`; **pos_sale_lines** — `sale_id, variant_id, qty, unit_cents, discount_cents, total_cents`; **pos_tenders** — `sale_id, method, amount_cents, payment_id null, change_cents`
- **cash_drawers** — `location_id, opened_by, opened_at, opening_cents, closed_at, closing_cents, expected_cents, variance_cents`
- **gear_fulfilments** — `household_id, person_id, membership_id, variant_ids uuid[], sizes jsonb, status (pending|ready|delivered)`
- **terminal_readers** — `location_id, stripe_reader_id, label`

## 4.8 Events, camps, after-school
- **events** — `location_id, kind (event|camp|party|seminar|tournament|ceremony), name, description, starts_at, ends_at, capacity, waiver_template_ids uuid[], pricing jsonb [{label, price_cents, per: person|day|week}], registration_opens_at, registration_closes_at, status, image_path`
- **event_days** — `event_id, date, starts_at, ends_at`
- **event_registrations** — `event_id, person_id, household_id, option_label, days uuid[] null, status (registered|paid|cancelled|attended), invoice_id, notes, allergies_ack bool`
- **event_checkins** — `event_day_id, person_id, in_at, out_at, in_by, out_by, pickup_person_name, signature_path`
- **afterschool_programs** — `location_id, name, weekly_price_cents, schools text[], active`; **afterschool_enrollments** — `program_id, person_id, household_id, school, pickup_route, days_of_week int[], status`; **afterschool_attendance** — `enrollment_id, date, picked_up_at, arrived_at, released_at, released_to, signature_path, absent bool, absence_reason`
- **authorized_pickups** — `person_id, name, relationship, phone, photo_path`

## 4.9 CRM, communications, marketing
- **pipeline_stages** — `name, order, kind (open|won|lost)`; **leads** — `person_id, stage_id, owner_user_id, value_cents, program_interest uuid[], score int null, next_action, next_action_at, lost_reason, converted_household_id, ai_run_id null`
- **lead_activities** — `lead_id, kind (note|call|email|sms|trial_booked|trial_attended|stage_change|task), body, by_user_id, at`
- **tasks** — `assignee_user_id, person_id null, lead_id null, title, due_at, done_at, source (manual|automation)`
- **communications** — `channel (email|sms|push|inapp), direction (out|in), person_id null, household_id null, to_address, template_key null, subject, body_text, body_html null, status (queued|sent|delivered|failed|unsent_no_provider|bounced|opted_out), provider, provider_message_id, error, thread_id null, campaign_id null, automation_run_id null, approval_item_id null, sent_at`
- **message_threads** — `household_id, subject, last_message_at, unread_staff int, unread_household int, assigned_user_id null`; **thread_messages** — `thread_id, sender_user_id null, sender_person_id null, body, attachments jsonb, read_by jsonb, communication_id null`
- **templates** — `key, channel, subject, body (mjml/react-email source or text), variables text[], is_system, overridden bool`
- **automations** — `name, trigger jsonb {kind, params}, conditions jsonb[], actions jsonb[], active, runs int`; **automation_runs** — `automation_id, person_id, context jsonb, status, log jsonb`
- **campaigns** — `name, channel, segment jsonb, template_id, scheduled_at, sent_at, stats jsonb`
- **segments** — `name, definition jsonb`
- **landing_pages** — `slug, title, blocks jsonb, published, offer_plan_id null, stats jsonb`
- **referrals** — `referrer_household_id, referred_person_id, code, status, credit_id null`
- **review_requests** — `person_id, sent_at, clicked_at, platform`

## 4.10 Documents & compliance
- **document_templates** — `kind (waiver|contract|policy|media_release), name, version int, body (rich text), required_for jsonb {programs, events, memberships}, active` unique(tenant_id, name, version)
- **signatures** — `template_id (version-specific), person_id (subject), signer_person_id, signer_user_id null, signed_at, ip, user_agent, typed_name, pdf_path, method (home|kiosk|desk|link)`
- **documents** — `person_id null, household_id null, kind, name, storage_path, mime, size, uploaded_by, expires_at null`
- **staff_certifications** — `user_id, kind, issuer, number, issued_at, expires_at, document_id null`

## 4.11 Staff ops
- **staff_profiles** — `user_id unique, person_id, title, programs uuid[], pay_rates jsonb {per_class_cents, hourly_cents, commission_pct}, hire_date, bio, photo_path`
- **time_entries** — `user_id, location_id, clock_in, clock_out, source (kiosk|desk), approved_by`
- **shifts** — `user_id, location_id, starts_at, ends_at, role_label`
- **commissions** — `user_id, ref_type (membership|pos_sale), ref_id, amount_cents, period, paid_at`
- **v_instructor_sessions** (view) — sessions taught per instructor per period

## 4.12 Reporting
- **saved_reports** — `report_key, name, params jsonb, schedule jsonb null, recipients text[], owner_user_id`
- **kpi_targets** — `metric, period, target numeric`
- **custom_report_definitions** — `name, entity, columns jsonb, filters jsonb, group_by jsonb` (P1)
- Views: `v_member_roster, v_attendance_by_class, v_retention_cohorts, v_churn_list, v_revenue_by_category, v_ar_aging, v_payments, v_trial_funnel, v_testing_eligibility, v_inventory_valuation, v_owner_dashboard`

## 4.13 AI
- **ai_models** [global] — `tier pk, model_id, input_cost_per_m numeric, output_cost_per_m numeric` (env-overridable)
- **ai_runs** — `task_id, tier, model_id, user_id null, person_id null, input_hash, input_summary, output jsonb null, valid bool, tokens_in, tokens_out, cost_cents numeric, latency_ms, status (ok|invalid|error|budget|no_key), error, transport (live|fixture)`
- **tenant_ai_budgets** — `month date, budget_cents, used_cents, hard_cap bool` unique(tenant_id, month)
- **approval_items** — `kind (drift_outreach|action_board|doc_intake|billing_recovery|parent_narrative|vision_feedback|copilot_write|other), status (pending|approved|rejected|expired), payload jsonb, preview text, ai_run_id, entity_type, entity_id, requested_by, decided_by, decided_at, feedback, executed_at, execution_result jsonb`
- **risk_scores** — `person_id, scored_at, score int (0-100), factors jsonb, explanation, outreach_approval_item_id null` (index person_id, scored_at desc)
- **kb_documents** — `title, kind (policy|faq|curriculum|schedule_digest|custom), body, source, indexed_at`; **kb_chunks** — `document_id, chunk_index, content, embedding vector(1536), tsv tsvector` (ivfflat/hnsw index; GIN on tsv)
- **class_recordings** — `session_id, audio_path, duration_s, transcript text null, status (uploaded|transcribing|ready|failed), ai_run_id, consent_checked bool`
- **technique_submissions** — `person_id, skill_id, video_path, keyframe_paths text[], status, feedback jsonb, ai_run_id, reviewed_by_user_id, released_to_student bool`
- **copilot_conversations** — `user_id, surface (desk|home), title`; **copilot_messages** — `conversation_id, role, content, tool_calls jsonb, citations jsonb, ai_run_id`

## 4.14 Imports & exports
- **imports** — `kind (spark|zenplanner|kicksite|generic_csv), file_path, mapping jsonb, status, stats jsonb, errors jsonb, by_user_id`
- **exports** — `kind (table|full), params jsonb, file_path, status, by_user_id, expires_at`

---

# §5 Milestones and tasks

Each task: **Build** (what to make; files/tables), **Acceptance** (mechanical check). Sizes: S (<1h of agent
work), M (1–3h), L (3h+ — split into commits). Feature ids (`F5.3`) point to §2.4; tables to §4.

Milestone order is fixed. Task order within a milestone is the recommended order; a task may be reordered if
a dependency is blocked. Every milestone ends with a **GATE** (Appendix B) and a tag.

---

## M0 — Foundation reset

**Goal:** repo builds and typechecks; local Supabase runs; migrations apply from zero; auth works; all four
surfaces render authenticated shells; gates run. **Demo increment:** sign up a school, log in, see empty
Desk/Mat/Home shells in the KoryoGraph design system.

### M0.01 Environment & local Supabase (S)
Build: run §0.9 Preflight. `supabase init` (if no `supabase/config.toml`), set `project_id = "koryograph"`,
enable `auth.hook.custom_access_token` pointing at `pg-functions://postgres/auth_hook/custom_access_token`
(create the schema in M0.07), set `[auth] site_url`, additional redirect URLs for `localhost:3000/**`.
`supabase start`. Write `.env.example` with every variable this document mentions (grouped, commented) and
copy to `.env.local` with the local stack's URL/anon/service keys from `supabase status -o env`.
Acceptance: `supabase status` shows API/DB/Studio running; `.env.example` committed; `.env.local` ignored.

### M0.02 State files, CLAUDE.md (S)
Build: `docs/build/PROGRESS.md` (Appendix D template, preflight result recorded), `docs/build/DECISIONS.md`
(header + ADR-0001 "Consolidate to single app; Supabase platform; OpenRouter"), `CLAUDE.md` (≤60 lines:
commands, gate, where the spec lives, the honesty rules in 5 bullets).
Acceptance: files exist; `git log` shows the commit.

### M0.03 Execute keep/delete (§1.4) (S)
Build: `git mv` archived docs to `docs/archive/` + README there; delete listed apps/packages/SQL; keep
`packages/ui/src/globals.css` temporarily at `packages/ui/src/styles/legacy-globals.css` (removed in M0.05).
Acceptance: `ls apps` → empty (until M0.04); `git status` clean after commit; no references to deleted
packages remain (`grep -r "@repo/database\|@repo/ai-core\|@repo/types" --include=*.json --include=*.ts .`
→ 0 hits outside docs/archive).

### M0.04 Scaffold `apps/web` + workspace wiring (M)
Build: `apps/web` via `npx create-next-app@16.3.5` (TS, App Router, Tailwind **no** — added in M0.05,
ESLint, `src/` dir, import alias `@/*`). Rename `packages/eslint-config`+`typescript-config` →
`packages/config` (or keep both; update names to `@koryo/config-eslint`, `@koryo/config-ts`). Root
`package.json` scripts: `dev`, `build`, `check` (`turbo run typecheck lint test`), `typecheck`, `lint`,
`test`, `test:db`, `test:e2e`, `db:start|stop|reset|migrate|types|seed`, `jobs:tick`, `gate`,
`ai:record|eval`, `smoke:live`. `turbo.json` tasks for each. Pin all versions (§3.1). Route-group folders
`(public) (desk) (mat) (home) (kiosk)` with placeholder `page.tsx` that render a `<PageHeader>` and an
honest `<EmptyState>` ("Nothing here yet — built in M1").
Acceptance: `npm install` clean; `npm run typecheck && npm run lint && npm run build` green; `npm run dev`
serves `/`, `/desk`, `/mat`, `/home`, `/kiosk` (200).

### M0.05 Design system (M) — §3.10
Build: Tailwind 4 with `@tailwindcss/postcss`; `packages/ui` as a source package (`exports` → `./src/*`,
transpiled by Next via `transpilePackages`); `styles/tokens.css` ported from legacy globals (all 5 themes),
`@theme` mapping, `globals.css` importing fonts (`@fontsource-variable/*`) and tokens; `npx shadcn@latest
init` + `add` the component list in §3.10; app components `PageHeader, StatCard, EmptyState, ThemeToggle,
MoneyText, DateText, RankBadge, PersonChip`. Delete `legacy-globals.css`.
Acceptance: Storybook-free visual check page `/dev/ui` (dev-only route, 404 in prod) renders every
component in each theme; `npm run build` green; Playwright `tests/e2e/ui.spec.ts` screenshots `/dev/ui` in
`koryo-red` and `light` without console errors.

### M0.06 `packages/db` (M) — §3.3/3.4
Build: `createBrowserClient()`, `createServerClient(cookies)` (correct `getAll/setAll`), `createServiceClient()`
(imports `server-only`; throws if imported client-side), `Database` types generated by
`npm run db:types` (`supabase gen types typescript --local > packages/db/src/types.gen.ts`), typed helper
`rpc<T>()`, `queries/` folder scaffold, `withAudit()` helper (M0.07).
Acceptance: unit tests for client factories' env validation; `db:types` produces a file that typechecks.

### M0.07 Migrations 0001–0005: platform, identity, RBAC, audit, hook (L)
Build (plain SQL under `supabase/migrations/`, one concern per file, idempotent-safe):
0001 extensions (`pgcrypto`, `vector`, `pg_trgm`, `citext`), schema `app`, `app.set_updated_at()`,
`app.tenant_id()`, `app.user_id()`, `app.has_permission()`, `app.has_module()`, `app.is_platform_admin()`,
`app.household_ids()` (placeholder until M1.01), and a **policy generator** function
`app.apply_tenant_policies(table regclass, write_permission text)` that creates the standard four policies.
0002 tenants, locations, tenant_domains, modules, plans, plan_modules, tenant_entitlements,
tenant_subscriptions, platform_admins, jobs, job_runs, api_keys, webhook_endpoints, webhook_deliveries.
0003 profiles (+ trigger creating a profile on `auth.users` insert), permissions, roles, role_permissions,
tenant_users, staff_invitations. 0004 audit_events + `app.audit()` trigger factory applied to every
tenant-scoped table as they're created. 0005 schema `auth_hook` + `custom_access_token(event jsonb)`
(adds `tenant_id, role, permissions, modules`; grants per Supabase docs) + `app.create_tenant(name, slug,
tz, owner_user_id)` RPC that seeds default roles/permissions/entitlements (`core` trial of all modules for
14 days) inside one transaction. `supabase/seed.sql`: modules, plans, plan_modules, permissions catalogue,
jobs.
Acceptance: `supabase db reset` applies cleanly; `tests/db/migrations.test.ts` asserts tables exist;
`tests/db/guards.test.ts` (§3.4 a–e) passes for all tables so far; hook test: mint a user via
`auth.admin.createUser`, add to a tenant, sign in with password, decode JWT → claims present.

### M0.08 Auth flows, middleware, surface shells (L) — F2.1, F2.2
Build: `(public)/login`, `/signup` (M0.09 completes), `/forgot-password`, `/reset-password`,
`/auth/callback` (code exchange), `/auth/confirm` (magic link), Google OAuth button (works when
`SUPABASE_AUTH_GOOGLE_*` configured; otherwise hidden with a settings note — not a dead button).
`middleware.ts` per §3.3. `src/server/context.ts` (`getCtx`, `require*`). Surface layouts: Desk (sidebar
nav from a `NAV` config with module + permission gating; top bar with ⌘K, approvals badge placeholder,
user menu, theme), Mat (bottom tabs), Home (bottom tabs + family switcher placeholder), Kiosk (bare).
Tenant switcher for multi-tenant users. Sign-out.
Acceptance: Playwright `auth.spec`: password login → redirected by role to the right surface; unauthenticated
`/desk` → `/login?next=/desk`; instructor cannot open `/desk` (403 page); magic link flow via Supabase
local Inbucket (`http://localhost:54324`) works; `getUser()` used (grep guard: `getSession(` count in
`src/server` = 0).

### M0.09 Self-serve signup → tenant (M) — F1.3, F1.4
Build: `/signup` form (school name, your name, email, password, timezone) → `auth.signUp` → on session:
server action `createTenantForCurrentUser` → `app.create_tenant` RPC → set `active_tenant_id` →
`refreshSession` → `/desk/onboarding` checklist page (steps persisted in `tenants.onboarding`).
Acceptance: `signup.spec`: new user ends on `/desk/onboarding` with the owner role and 14-day trial
entitlements; second signup yields a distinct tenant; RLS matrix (M0.11) proves isolation.

### M0.10 Test infrastructure & gate (M) — §3.9, Appendix B
Build: vitest workspace config (unit + db projects), `tests/db/harness.ts` (`resetDb()` = `supabase db
reset`; `mintSession(email)` via admin API; per-role clients), Playwright config (`webServer` = `npm run
dev`, storage-state fixtures per role created in `global-setup` from seeded accounts), `@axe-core/playwright`
helper, ESLint rules: `no-restricted-syntax` for identifiers `/^(MOCK|FAKE|DUMMY)_/`, literal
`'placeholder-id'`, JSX attribute `dangerouslySetInnerHTML`; `no-console` (allow in `scripts/`).
`scripts/gate.ts` per Appendix B.
Acceptance: `npm run check`, `npm run test:db`, `npm run test:e2e`, `npm run gate -- m0` all run and pass.

### M0.11 Seed framework + RLS matrix (M) — Appendix C
Build: `scripts/seed/index.ts` with `seedrandom('koryograph')`, faker seeded, `--profile minimal|demo`.
`minimal` = two tenants ("Ridgeline Taekwondo", "Harbor BJJ"), one user per role each, one location. Demo
accounts + password `KoryoDemo!2026` documented in `docs/build/DEMO-ACCOUNTS.md`. `tests/db/rls-matrix.test.ts`
iterates `information_schema.columns where column_name='tenant_id'`.
Acceptance: `npm run db:reset` (= reset + seed minimal) twice → identical row counts and ids; RLS matrix
green for all current tables.

### M0.12 CI (S)
Build: `.github/workflows/ci.yml`: node 22, `supabase start`, `npm ci`, `npm run gate -- all` (with
`AI_TRANSPORT=fixture`, no Stripe key → Stripe unit tests use stripe-mock via a service container or the
downloaded binary).
Acceptance: workflow file validates (`npx action-validator` optional); documented in CLAUDE.md.

**GATE M0** → tag `m0-complete`.

---

## M1 — Run the school

**Goal:** the daily operating loop works end to end on real data: people & households, programs & ranks &
curriculum, schedule, attendance from Mat/Desk/Kiosk/Home, bookings & waitlists, messaging outbox, waivers,
owner dashboard, exports. **Demo increment:** Alex opens Mat on a tablet, sees today's classes, checks in a
roster, awards a stripe, and the parent sees it on Home within a refresh.

### M1.01 Migrations: people & households (M) — F3.1, F2.5–2.7
Build: `people, households, household_members, consents, kiosk_devices, person_pins` (+ `app.household_ids()`
real implementation; RLS: staff via tenant policies; Home users read `people` in their households, own
`households`). Views `v_people_search` (name trigram). Sequence for `invoices.number` later.
Acceptance: guards + matrix green; `tests/db/people.test.ts` covers household self-access from a guardian
session (sees own kids, not others).

### M1.02 People & households UI (L) — F3.1–3.3
Build: `/desk/people` DataTable (search-as-you-type, status/program/tag filters, columns, CSV export,
bulk tag); `/desk/people/new` (person + household in one form; add guardian/student rows; consent
checkboxes for minors); `/desk/people/[id]` profile shell with tabs (Overview, Household, Attendance,
Progress, Billing, Documents, Messages, Notes) — each tab renders a real query or an honest EmptyState
("No memberships — Billing module lands in M2"); medical notes gated by `people.medical.read`; edit forms;
household page `/desk/households/[id]`.
Acceptance: `desk-people.spec`: create household with guardian + 2 students → appears in list → search finds
by partial name → medical field hidden for `front_desk` role without the permission → CSV export downloads
with the right row count.

### M1.03 Migrations: programs, ranks, curriculum, progression (M) — F4.1–4.5
Build: tables in §4.3; `v_enrollment_progress` (classes since promotion, days since, skills required vs
signed). Trigger maintaining `enrollments.classes_since_promotion` from `attendance`.
Acceptance: guards/matrix; unit tests for trigger via db test.

### M1.04 Programs, ranks, curriculum admin (M)
Build: `/desk/programs` list; `/desk/programs/[id]` with rank ladder editor (drag order, belt color
picker, stripes, fee), requirements per rank (min classes/days, required skills multi-select, instructor
approval), curriculum library `/desk/curriculum` (skills CRUD with category, rubric rows, video URL),
lesson plan templates. Default seed for a new tenant: one program "Taekwondo" with the standard 10-gup
ladder (white→black) and 8 sample skills, applied by `app.create_tenant`.
Acceptance: `desk-programs.spec`: add rank, reorder, set requirement, attach skills; new tenant has default
ladder.

### M1.05 `packages/eligibility` + enrollment UI (M) — F4.2, F4.4
Build: `evaluate({enrollment, requirements, attendanceCount, daysSince, signoffs, approvals}) →
{status, gaps[]}` pure function with table-driven tests (≥12 cases incl. edge: no requirements, stripes
irrelevant). Enrollment actions: enroll person in program at rank, manual promote (with reason), award
stripe, sign off skill (Desk + Mat). Profile → Progress tab shows ladder, requirements progress, history.
Acceptance: unit tests green; `desk-progress.spec` promotes and sees history.

### M1.06 Migrations: scheduling & attendance (M) — F5.1–5.6
Build: §4.4 tables + `v_attendance_velocity` + `v_class_roster` (eligible people for a session: program
match, rank range, age range, membership status active/trial — status only until M2 adds plan rules).
Job `materialize_sessions` (rolling 90 days from templates + exceptions + holidays; idempotent upsert).
Acceptance: db tests: RRULE weekly Mon/Wed 17:00 for 4 weeks → 8 sessions; exception cancels one; holiday
removes one; rerun changes nothing.

### M1.07 Schedule admin (L) — F5.1, F5.2
Build: `/desk/schedule` week view (custom grid, not a heavy lib) with location/program filters; template
CRUD with an RRULE builder UI (weekly days + time + start/end, monthly optional), capacity, instructors,
rank/age bounds, bookable + cancellation window; per-session actions: cancel (notify roster → outbox),
change instructor, add note; holidays admin.
Acceptance: `desk-schedule.spec`: create template → sessions appear in the week view → cancel one → it
shows cancelled and a queued communication exists for a booked/enrolled person.

### M1.08 Mat surface (L) — F5.3, F4.4, F3.3
Build: `/mat` today (sessions for my location(s), now-next highlighting), `/mat/session/[id]` roster with
large tap targets, check-in toggle (optimistic; client queue in IndexedDB replays on reconnect; conflict =
server wins), add walk-in (search), quick card (photo, rank, stripes, allergies/injury flags, guardian phone,
eligibility status), one-tap stripe award, skill sign-off sheet (rank's required skills), lesson plan panel,
"Record class" placeholder that is **disabled with copy "Available with Intelligence module (M4)"**.
`/mat/students` search, `/mat/schedule` week.
Acceptance: `mat-attendance.spec` (390px viewport): check in 3 students → refresh → persisted → award a
stripe → Home shows it (login as parent in the same test); offline test: block network, toggle, unblock →
synced.

### M1.09 Kiosk (M) — F5.3, F2.7
Build: `/kiosk` pairing screen (staff logs in → "Pair this device" → `kiosk_devices` token cookie, 1 year);
locked mode: big search (first name/last name, ≥2 chars, debounced, `v_people_search`), tap person → if
family: pick members → PIN (household PIN, set in Desk/Home; 4 digits; 5 fails → 15-min lockout) or photo
confirm (staff-configurable) → shows today's sessions to check into (auto-select the one starting within
±30 min) → success screen 3 s → reset. Attendance `source='kiosk'`.
Acceptance: `kiosk.spec`: pair, search "ma" → Maya, PIN, check-in → appears in Mat roster; wrong PIN ×5 →
lockout message.

### M1.10 Bookings, waitlists, makeups (M) — F5.4, F5.5
Build: booking actions (book, cancel within window, waitlist join, auto-promote on cancel → outbox
notification), Desk session roster shows booked/waitlisted, Home `/home/schedule` list + book/cancel;
makeup credits earned on excused cancellation (rule in tenant settings), consumed on booking.
Acceptance: `bookings.spec`: capacity 2; third booker waitlisted; first cancels → third promoted, credit
created for the canceller if within rule.

### M1.11 Communications core + Outbox + inbox (M) — F10.1–10.4
Build: migrations §4.9 (`communications, templates, message_threads, thread_messages`); `packages/comms`
with Resend/Twilio providers (used only when keys exist) and Outbox fallback; system templates (react-email
for email, text for SMS) with merge fields and per-tenant override UI `/desk/settings/templates` (preview
with sample data); consent + quiet hours; Desk `/desk/inbox` (threads, reply, assign) and `/desk/outbox`
(status, resend); Home `/home/messages` (thread with school); Mat "message this class" (broadcast to
roster guardians → outbox). Inbound webhooks routes (`/api/webhooks/twilio`, `/api/webhooks/resend`) with
signature verification.
Acceptance: unit: template render; consent blocks; quiet hours defers. `comms.spec`: parent sends message →
staff sees unread badge → replies → parent sees; cancelled class creates outbox rows with
`unsent_no_provider` when no key.

### M1.12 Documents & waivers (M) — F12.1–12.3
Build: migrations §4.10; template editor (rich text via a light editor — `@tiptap/*` acceptable — with merge
fields), versions, required-for rules; signing UI (Home, kiosk "sign now" prompt when required doc is
unsigned, and emailed link `/sign/[token]`), typed-name signature + timestamp + IP + generated PDF stored in
`tenant-media`; compliance widget (unsigned required docs by person); document vault uploads on profile.
Acceptance: `documents.spec`: publish waiver v1 required for program → parent prompted on Home → signs →
PDF exists in storage → publish v2 → prompted again; Desk compliance list decreases.

### M1.13 Owner dashboard v0, reports v0, exports (M) — F14.1, F14.2, F1.7
Build: `/desk` dashboard cards (active students, trials, attendance this week vs last, unsigned docs, upcoming
tests placeholder) all from `v_owner_dashboard`; `/desk/reports` index + `roster`, `attendance` reports
(table + recharts chart + CSV); Settings → Data export (ZIP of JSON per table, generated by a job, download
link).
Acceptance: dashboard numbers equal SQL truth on seed (db test computing the same aggregates); export ZIP
contains one file per tenant-scoped table with correct row counts.

### M1.14 Demo seed: Ridgeline v1 (L) — Appendix C
Build: `--profile demo`: ~250 students, ~120 households, 4 programs with realistic rank distribution, 2
years of sessions and attendance with patterns (steady, improving, decaying → drift signals), promotions
history, stripes, sign-offs, consents, waivers signed (some not), kiosk device, PINs, threads/outbox samples.
Acceptance: `npm run db:reset -- --profile demo` < 90 s; deterministic; dashboard and Mat show data;
`seed.test.ts` asserts invariants (no student without household; attendance only in sessions that exist).

### M1.15 E2E suite M1 + a11y (M)
Build: specs listed above consolidated under `tests/e2e/m1/`; axe on `/desk`, `/desk/people`, `/mat`,
`/kiosk`, `/home` with zero serious/critical violations.
Acceptance: `npm run gate -- m1` green.

**GATE M1** → tag `m1-complete`.

---

## M2 — Get paid

**Goal:** money works: plans, memberships, invoices, autopay, dunning, Home wallet, POS and inventory, AR and
revenue reports — with Stripe in test mode. **Demo increment:** enroll a new family, charge a test card,
see the invoice paid; a failed card enters dunning; sell a uniform at POS; parent pays from Home.

### M2.01 Migrations: billing (M) — §4.6
Build: all billing tables + sequences + `v_ar_aging`, `v_mrr`, `v_household_balance`; trigger maintaining
`invoices.paid_cents/balance_cents/status` from allocations; `households.balance_cents`.
Acceptance: guards/matrix; db tests for status transitions on allocation and void.

### M2.02 `packages/billing` engine (M) — F7.1–7.4
Build: pure functions per §3.5 with ≥40 table-driven tests (proration by day, upgrade mid-cycle, family
discounts stacking rules, coupon caps, tax, paid-in-full recognition schedule, dunning schedule steps,
allocation FIFO oldest-first, freeze proration).
Acceptance: `vitest run packages/billing` green; 100% branch coverage on the engine files.

### M2.03 Stripe integration (L) — F7.8
Build: `packages/payments` (Stripe client factory with `stripeAccount`), Connect Standard onboarding
(`/desk/settings/payments` → create account → account link → return/refresh routes → status), Customer
sync per household, SetupIntent vault (Elements on Desk and Home), PaymentIntent charge (on-session and
off-session), Terminal connection token + reader registration (simulated reader in test mode), refunds;
`/api/stripe/webhook` with signature check, `stripe_events` idempotency, handlers for the event list in
F7.8; `stripe listen` instructions in CLAUDE.md. Unit tests against stripe-mock (`STRIPE_MOCK=1` → host
override); handler tests with fixture events under `tests/fixtures/stripe/`.
Acceptance: unit + handler tests green; with a real test key: `stripe.spec` vaults `4242…` via Elements and
charges $1.00 successfully; `4000 0000 0000 0341` fails and creates a failed payment row.

### M2.04 Plans admin + enrollment flow (L) — F7.2, F7.3, F8.4, F3.6 (billing half)
Build: `/desk/billing/plans` CRUD (all plan kinds, attendance rule, family discount, gear package,
enrollment fee, public toggle); `/desk/people/[id]` → "Enroll in membership" wizard: choose plan → start
date/billing day → discounts (auto family) → gear sizes → review invoice preview (engine) → pay now (card on
file / new card / cash / later) → creates membership, invoice, payment, gear fulfilment, enrollment in
program(s), status `active`. Contracts capture e-sign of the membership agreement (document template kind
`contract`) if configured.
Acceptance: `enroll.spec`: second child gets the family discount on the preview and the invoice; paying
with test card marks invoice paid and membership active; gear fulfilment appears in `/desk/retail/fulfilment`.

### M2.05 Billing run, invoices & AR UI (L) — F7.4, F7.6
Build: job `billing_run` (daily: memberships with `next_bill_at <= today` → invoices via engine → autopay
charge attempts → advance `next_bill_at`; idempotent by (membership, period)); `/desk/billing/invoices`
list/filters/aging, invoice detail (lines, payments, timeline, actions: take payment, add line, discount,
void, refund, email receipt), household balance & credits; `/desk/billing` AR dashboard.
Acceptance: db test: run twice → no duplicate invoices; `billing.spec`: run job via `/api/jobs/billing_run`
with `CRON_SECRET` → expected invoices for seeded households; take a cash payment → status paid; refund
partially → status partially_refunded and credit note.

### M2.06 Dunning (M) — F7.5
Build: job `dunning` executes `dunning_policies` steps per past-due invoice (retry PaymentIntent, queue
email/SMS templates `payment_failed_1..n`, suspend membership at final step); card-update link
(`/home/wallet?invoice=` or Stripe hosted); membership `past_due → suspended`; Desk widget "Failed payments".
Acceptance: `dunning.spec`: seed failed payment → run job on day 1/3/7 (clock injection) → communications
queued at each step → suspension at final; updating the card and retrying clears it.

### M2.07 Home wallet & billing (M) — F7.7, F15.4
Build: `/home/billing`: balance, invoices (pay now with Elements), receipts, payment methods (add/remove/
default), autopay toggle per membership, membership details (next bill, hold request → creates task for
staff).
Acceptance: `home-billing.spec`: parent pays an open invoice with test card → Desk shows paid.

### M2.08 Migrations + admin: retail & inventory (M) — F8.1, F8.2
Build: §4.7 tables; `/desk/retail/products` (variants grid, images upload, barcode), `/desk/retail/inventory`
(levels per location, adjust with reason, movement ledger, low-stock list), suppliers.
Acceptance: `retail-admin.spec`: create product with 3 sizes; adjust stock; low-stock shows when below
reorder point.

### M2.09 POS (L) — F8.3
Build: `/desk/pos` (tablet-friendly): search/scan (barcode input), cart, attach household, line discounts,
tenders (cash with change calc, check, card on file, Terminal via simulated reader, account credit, split),
tax by location, receipt (print view + email), returns/exchanges referencing the sale, cash drawer
open/close with variance. Sales create `invoices` (source `pos`) + `payments` + inventory movements.
Acceptance: `pos.spec`: sell 2 items with cash → inventory decremented → receipt → return one → inventory
restored, refund recorded; drawer variance computed.

### M2.10 Reports: money (M) — F7.9, F7.10, F14.2
Build: revenue by category/period, AR aging, payments & refunds, MRR/churn MRR, deferred revenue for
paid-in-full; accounting CSV export (invoice lines by GL class + payments).
Acceptance: db tests compare report views to engine-computed totals on seed.

### M2.11 Demo seed v2: money (M)
Build: plans (6), memberships for all active students, 2 years of invoices/payments with 4% failure rate,
some past-due in various dunning stages, credits, refunds, 40 SKUs with stock and POS history, gear
fulfilments.
Acceptance: dashboard MRR/AR non-zero and equal to view truth; seed invariants extended.

### M2.12 E2E suite M2 (S)
Acceptance: `npm run gate -- m2` green (Stripe-dependent specs are tagged `@stripe` and run only when
`STRIPE_SECRET_KEY` exists; otherwise recorded as HANDOFF, not as passes).

**GATE M2** → tag `m2-complete`.

---

## M3 — Grow & progress

**Goal:** the growth and progression loops: belt testing end to end, lead pipeline → trial → member,
automations and broadcasts, events/camps/after-school, staff ops. **Demo increment:** Alex opens next
week's test, sees the auto-roster with "almost eligible" gaps, invites, a parent registers and pays from
Home, judges score, bulk promote prints certificates; a web lead books a trial and converts.

### M3.01 Migrations + testing events (L) — F6.1–6.4
Build: §4.5 tables; `/desk/testing` list; event create (programs, fee, deadline, capacity, judges); roster
tab: **Eligible** (engine), **Almost** (gaps listed), **Manual add** (override reason); invite selected →
communications (template `test_invitation`) + Home registration; `/home/testing/[id]` register + pay fee
(invoice source `testing`); Desk confirm roster; scoresheet UI per judge (rubric from rank's skills;
mobile-friendly for Mat too at `/mat/testing/[id]`); results; **Bulk promote** → promotions, stripes reset,
`classes_since_promotion` reset, certificate PDFs (pdf-lib from `certificate_templates`, batch ZIP), Home
progress updated, congratulation communication queued.
Acceptance: `testing.spec`: eligible list matches engine on seed; invite → parent registers & pays → judge
scores → bulk promote → rank history + certificate file present; Kukkiwon CSV export (F6.5) has the
required columns for black-belt candidates.

### M3.02 Migrations + CRM pipeline & trials (L) — F3.4–3.6, F11.1
Build: §4.9 CRM tables; `/desk/crm` kanban (dnd-kit) with stages editor; lead detail (activities timeline,
tasks, program interest, source/UTM); lead capture: `(public)/s/[tenantSlug]/trial` page + embeddable widget
(`/widget/[tenantSlug].js` renders an iframe form) → `leads` + optional trial booking into a real bookable
session; duplicate detection; **Convert** action → runs M2.04 enrollment wizard pre-filled and moves the lead
to `won` with `converted_household_id`; lost reasons.
Acceptance: `crm.spec`: submit public form → lead in `new` → drag to `trial_scheduled` (booking created) →
attend via Mat → stage auto-advances to `trial_attended` → convert → membership active; duplicate email
merges to existing lead.

### M3.03 Automations & broadcasts (L) — F10.5, F10.6
Build: `automations` engine (`src/server/automations/`): triggers emitted from domain events
(`emit('person.status_changed', …)` in server actions), plus scheduled evaluators (absence ≥N days,
birthday, membership expiring, contract ending); conditions (program, status, tag, has consent); actions
(send template, create task, add tag, wait N days, notify staff); run log. Editor `/desk/automations` as a
structured form (trigger → conditions → ordered actions), not a canvas. 8 seeded templates: welcome
sequence, absent 7/14/30 days, failed payment, trial follow-up, test invitation reminder, birthday,
membership expiring, review request. Broadcasts `/desk/broadcasts` with segment builder + preview count +
send (email/SMS) + stats.
Acceptance: `automations.spec`: enabling "absent 14 days" and running the evaluator job queues messages for
exactly the seeded absent students; broadcast to segment "Youth TKD, active" creates N communications where
N equals the segment count; consent-less person excluded.

### M3.04 Events, camps, parties (L) — F9.1, F9.2, F9.4
Build: §4.8 event tables; `/desk/events` calendar+list; event wizard (kind, days, pricing options, capacity,
required waivers); registration Desk + `/home/events` (choose option/days, sign required waivers, pay);
roster with allergies/pickup flags; day check-in/out screen (tablet) with pickup name + signature pad;
birthday party package with deposit invoice and guest waiver link.
Acceptance: `events.spec`: create camp with 3 days; parent registers 2 days and pays; day check-in/out with
signature stored; capacity enforced; guest waiver link signs without login.

### M3.05 After-school (M) — F9.3
Build: programs, enrollments with schools/routes/days, daily manifest by route (printable), attendance
in/out with signature and absence alerts (communication to guardians when a child expected isn't picked
up by cutoff), weekly billing via a membership plan kind `recurring` interval `week` linked to enrollment.
Acceptance: `afterschool.spec`: manifest lists correct kids per route/day; marking absent triggers a queued
alert; weekly invoice generated by billing run.

### M3.06 Staff ops (M) — F13.1–13.3
Build: staff profiles (certs with expiry + compliance widget), `/kiosk` staff clock-in/out (PIN), shifts,
`v_instructor_sessions`, commissions on memberships/POS by seller, payroll export CSV per period; tasks
(`/desk/tasks`, assignment, due, from automations).
Acceptance: `staff.spec`: expired cert shows in compliance; instructor session count for last month equals
seeded sessions taught; payroll CSV totals match view.

### M3.07 Reports: growth (M) — F14.2
Build: trial funnel, retention cohorts (by start month), churn list (cancelled + reasons), testing
eligibility, staff sessions, event revenue.
Acceptance: db tests vs SQL truth.

### M3.08 Demo seed v3 (M)
Build: pipeline with 9 leads across stages (UTM sources), testing event next Saturday with eligible/almost
sets, a summer camp and a parents' night out, after-school program with 18 kids on 2 routes, staff certs
(one expiring), automations enabled with run history, broadcasts sent.
Acceptance: invariants; demo script prerequisites (§6) satisfied.

### M3.09 E2E suite M3 (S)
Acceptance: `npm run gate -- m3` green.

**GATE M3** → tag `m3-complete`.

---

## M4 — Intelligence

**Goal:** the AI layer per §2.5, every agent with a real code path, an approval gate, logging, budgets, and
fixture-based tests; live behaviour when `OPENROUTER_API_KEY` exists. **Demo increment:** the five things
Spark can't do (§6 steps 9–13).

### M4.01 `packages/ai` gateway (L) — §3.6
Build: OpenAI SDK client → OpenRouter; task registry + zod schemas; tiers → models (choose current, capable
models from OpenRouter's catalogue for `fast`, `frontier`, `vision`, `audio`, `embed`; record the choice
and the date in DECISIONS.md; make them env-overridable `AI_MODEL_FAST` etc.); `runTask()` with
structured-output request, validation, one retry with error feedback, `ai_runs` logging, budget check
(`tenant_ai_budgets`), cost computation from `ai_models`; transports `live`/`fixture`; `npm run ai:record`
(runs a task list live and writes fixtures); `npm run ai:eval` (live schema-validity check for every task,
prints a table). `/desk/settings/ai`: key status (platform key by default; tenant BYO key optional), budget,
model tiers, usage this month, "Test connection".
Acceptance: unit tests with fixture transport for `runTask` (valid, invalid→retry→fail, budget exceeded,
no key → `status='no_key'` and typed error); `ai:eval` passes when a key exists (else HANDOFF).

### M4.02 Approval queue (M) — §2.5
Build: `approval_items` UI `/desk/inbox/approvals` (filters by kind; card with preview + editable payload
+ approve/reject + reason; bulk approve; keyboard j/k/a/r); executor `executeApproval(item)` dispatching by
kind; topbar badge count; audit entries.
Acceptance: `approvals.spec`: seeded pending items → approve one → executed side effect visible (e.g.
communication queued) → reject one with feedback → stored.

### M4.03 Knowledge base + RAG (M) — §2.5
Build: `kb_documents/kb_chunks`, chunker (~500 tokens, overlap), embeddings via `embed` tier, hybrid search
RPC `app.kb_search(query, embedding, k)` (RRF over cosine + tsvector), `/desk/settings/knowledge` (add
policy/FAQ, re-index, test search), nightly `schedule_digest` document auto-generated from templates.
Acceptance: db test: search "refund policy" returns the seeded refund policy chunk first (fixture embedding
vectors stored with the seed to stay deterministic).

### M4.04 A1 Desk Copilot + A2 Home Assistant (L)
Build: `/desk/copilot` (⌘K "Ask") chat with streaming, tools (`find_person`, `person_summary`,
`attendance_summary`, `invoices_for_household`, `run_report(key, params)`, `kb_search`, `propose_action`
→ approval item), citations rendered as chips linking to records; conversations persisted. `/home/assistant`
with KB-only context + household context (own kids only), escalation button creates a thread.
Acceptance: fixtures for 6 prompts; `copilot.spec`: "How many students are past due?" returns a number
equal to the AR view and cites the report; Home assistant refuses a question about another family
(fixture) and offers to message the desk.

### M4.05 A3 Drift Detector (M)
Build: nightly job `drift_score`: rule-based score (attendance velocity drop, days since last visit,
past-due, tenure, recent negative notes) in `packages/ai/drift.ts` (pure, unit-tested) → top N per tenant
→ LLM explanation + draft outreach (SMS+email variants) → `risk_scores` + `approval_items(kind
drift_outreach)`; Desk dashboard "At risk" card + `/desk/people?risk=high`; profile insight panel.
Acceptance: unit tests for scoring; `drift.spec`: run job on demo seed → the seeded decaying students are in
the top list → approve outreach → communication queued.

### M4.06 A4 Post-class Action Board (L)
Build: Mat "Record class": upload audio (MediaRecorder in browser or file) → `class_recordings` (consent
check: all minors on roster need `ai_processing` consent, else list who's missing and offer manual mode) →
job `transcribe` (audio tier) → `action_board` task (frontier): NER vs roster (fuzzy names → person ids,
confidence), attendance confirmations, per-student skill notes mapped to `skills`, injury flags, follow-ups
→ Action Board UI `/mat/session/[id]/board`: rows with confidence, edit, approve all → writes attendance
(source `action_board`), sign-offs, notes, tasks.
Acceptance: fixture transcript for a seeded session; `action-board.spec`: approve all → 9 attendance rows +
3 sign-offs + 1 task created; low-confidence rows require explicit tick.

### M4.07 A5 Curriculum & lesson builder (M)
Build: `/desk/curriculum/build` and Mat "Plan this class": prompt + program + rank band + weeks → draft
lesson plans referencing existing `skills` (never inventing skill ids; unknown → suggested new skill flagged)
→ edit → save as templates or assign to sessions.
Acceptance: fixture; `curriculum.spec`: generated plan saved and visible on a session in Mat.

### M4.08 A6 Document intake (M)
Build: `/desk/retail/receive` upload packing slip (image/PDF → vision tier) → draft PO receive lines with
fuzzy SKU match + confidence → approve → inventory movements; `/desk/settings/import` upload competitor
export → AI proposes column mapping → user confirms → generic importer (M5.03) runs.
Acceptance: fixture for a sample Century-style packing slip in `tests/fixtures/docs/`; `intake.spec`:
approve → stock increases by extracted quantities.

### M4.09 A7 Natural-language reports (M)
Build: `/desk/reports/ask`: question → task `nl_report` returns `{sql, chart}`; SQL validated (single
SELECT, only whitelisted `v_*` views, no functions beyond an allowlist, `LIMIT` ≤ 5000) → executed under a
dedicated read-only DB role scoped by `app.tenant_id()` → table + recharts chart; "Save as report".
Acceptance: unit tests for the SQL validator (rejects writes, joins to base tables, unknown views);
fixture; `nl-report.spec` renders a chart for "attendance by program last 8 weeks".

### M4.10 A8 Billing recovery, A9 Parent narratives, A10 Lead scoring (M)
Build: dunning step `ai_message` uses A8 to draft tone-adjusted text → approval (or auto after first
approval if tenant setting); weekly job `parent_narratives` + on promotion → approval batch → Home feed
`/home` "This week"; lead scoring on lead create/update → score chip + suggested next action.
Acceptance: fixtures; specs: narrative approved appears on Home; lead created gets a score.

### M4.11 A11 Technique feedback (`vision`) + A12 schedule suggestions (M)
Build: `/home/progress/[skill]/submit` video upload (≤60 s, consent required for minors) → job extracts 6
keyframes (ffmpeg) → vision task with rubric (+ instructor gold-standard keyframes if uploaded on the skill)
→ feedback → instructor review queue in Mat → release to student; weekly `schedule_suggestions` task from
utilization/waitlist/no-show stats → Desk insights card.
Acceptance: fixture keyframes/video in `tests/fixtures/video/`; `vision.spec`: submit → instructor sees
review → release → student sees feedback with 3 tips; suggestions card renders with ≥1 suggestion on seed.

### M4.12 Demo seed v4 + fixtures (M)
Build: KB docs (policies, FAQ, curriculum text), pre-computed risk scores and pending approvals of each
kind, one recorded class with transcript, one technique submission, AI usage history; all fixtures recorded
(if key) or hand-authored to the schemas (if not — note in DECISIONS.md).
Acceptance: `npm run gate -- m4` green with `AI_TRANSPORT=fixture`; `ai:eval` result recorded.

**GATE M4** → tag `m4-complete`.

---

## M5 — Ship it

**Goal:** a school can find, buy, onboard, import, and run; the product is hardened; the demo script passes;
handoff is documented. **Demo increment:** the full §6 walkthrough, start to finish, on a fresh reset.

### M5.01 Public site (M) — F1.3
Build: `/` landing (rebuild the archived design intent in the design system: hero, three surfaces, the five
AI differentiators, pricing teaser, testimonial placeholders clearly marked as such — or omitted), `/pricing`
(from `plans`/`modules` tables, monthly/annual toggle, module picker → total), `/features`, `/contact`
(→ platform inbox), `/privacy`, `/terms` (plain drafts marked "draft — legal review pending"), `/login`,
`/signup` (plan preselect), SEO metadata, sitemap.
Acceptance: `public.spec`: every nav/footer link resolves (no 404s — a crawler test over the public site);
pricing totals match table data.

### M5.02 Onboarding wizard (M) — F1.4
Build: steps with real actions: location → programs (pick presets: Taekwondo/Karate/BJJ/Kickboxing ladders)
→ schedule (quick-add weekly grid) → students (import or add) → payments (Stripe Connect) → staff invites →
theme/branding → "Go live" (moves trial → active plan selection). Progress persisted; dismissible.
Acceptance: `onboarding.spec`: complete all steps on a fresh tenant in one run; dashboard populated.

### M5.03 Imports (M) — F1.7 counterpart, Appendix D of the old plan
Build: generic CSV importer (`imports`): upload → detect columns → mapping UI (target fields: people,
households, memberships, ranks, attendance) → validation report → dry-run → commit with progress; presets
for Spark / Zen Planner / Kicksite with best-known column names (documented as assumptions) and A6 mapping
assist; rollback by import id.
Acceptance: `import.spec`: import a 200-row sample CSV (`tests/fixtures/import/spark-sample.csv`) → 200
people, households linked by guardian email, ranks set; re-import is idempotent by external id.

### M5.04 Public API + webhooks (M) — F1.8
Build: `/api/v1/{people,attendance,invoices,memberships}` (GET, cursor pagination, filters) with API key
auth (`Authorization: Bearer kg_live_…`), rate limit; `webhook_endpoints` UI + dispatcher job with HMAC
signature and retries; OpenAPI JSON at `/api/v1/openapi.json`; `/desk/settings/api`.
Acceptance: `api.spec`: key created → GET people returns tenant's people only → other tenant's key gets
0 rows; webhook delivered to a local test receiver on `member.created`.

### M5.05 Home PWA & notifications (M) — F15.6, F10.7
Build: `manifest.webmanifest`, service worker (offline shell only), install prompt; notifications center
(`/home/notifications`) fed by communications with `channel='inapp'`; web push when VAPID keys exist
(else in-app only, stated).
Acceptance: Lighthouse PWA installable on `/home`; notification appears after a queued in-app message.

### M5.06 Multi-location (M) — F1.9
Build: location switcher in Desk/Mat scoped by `tenant_users.location_ids`; rollup toggle on dashboard and
reports; per-location inventory already exists; staff scoping in RLS via `app.location_ids()`.
Acceptance: db test: staff limited to location A cannot read sessions of location B; rollup sums both.

### M5.07 Accessibility & performance pass (M) — §2.6
Build: axe on 15 routes (list them in the spec) with zero serious/critical; keyboard traversal test on Desk
nav, dialogs, POS; loading/empty/error states audit — every list route has skeleton + EmptyState + error
boundary; performance: log server timing on the 10 heaviest queries and fix any > budget (indexes, views).
Acceptance: `a11y.spec` green; `perf.test.ts` asserts query timings on demo seed under budget.

### M5.08 Security review (M) — §2.6
Build: checklist executed and recorded in `docs/SECURITY-REVIEW.md`: service-role usage grep confined to
allowed paths; every server action begins with `getCtx` + `require*` (AST lint rule or grep test); RLS
guards; webhook signatures; kiosk lockout; rate limits on `/api/v1`, `/widget`, `/kiosk`, auth routes; CSP
headers; dependency audit (`npm audit --omit=dev` — record findings); secrets not in client bundle (`grep`
the `.next` client chunks for `sk_test`, `SERVICE_ROLE`).
Acceptance: `security.test.ts` encodes the greps; review doc committed.

### M5.09 Documentation (S)
Build: `README.md` (what/why/run/test/deploy in 1 page), final `CLAUDE.md`, `docs/RUNBOOK.md` (jobs,
webhooks, Stripe Connect, AI budgets, backups), `docs/HANDOFF.md` (= §7 filled with actual values/paths),
`docs/build/DEMO-ACCOUNTS.md`.
Acceptance: links resolve; commands in README run.

### M5.10 The Alex demo E2E (L) — §6
Build: `tests/e2e/demo/alex-walkthrough.spec.ts` executing §6 exactly, on a fresh `db:reset --profile demo`,
with screenshots per step saved to `docs/demo/screenshots/` (committed) and a generated
`docs/demo/WALKTHROUGH.md` with the screenshots inline.
Acceptance: spec green; walkthrough doc renders 13+ screenshots.

### M5.11 Final report, tag, push (S)
Build: `docs/build/FINAL-REPORT.md` per Appendix D; `git tag v0.1.0-prototype`; push with tags.
Acceptance: `npm run gate -- all` result pasted into the report verbatim; pushed.

**GATE M5** → tag `m5-complete`. **STOP.**

---

# §6 The Alex demo script (final acceptance)

Runs on `npm run db:reset -- --profile demo` + `npm run dev`. Fifteen minutes, one browser (Desk), one
tablet-sized window (Mat/Kiosk), one phone-sized window (Home). Every step is a real interaction against
real data; the Playwright spec `tests/e2e/demo/alex-walkthrough.spec.ts` performs exactly these steps.

**Part 1 — "It does everything Spark does" (parity)**
1. Login as `owner@ridgelinetkd.demo` → Desk dashboard: live counts (active students, MRR, AR past due,
   attendance this week vs last, at-risk count, trials in pipeline, next test, low stock).
2. People → search "Cooper" → household with 2 kids → profile: rank, requirements progress, attendance
   sparkline, invoices, signed waivers, messages.
3. Schedule → this week → open tonight's Youth TKD session → roster with booked/waitlisted.
4. Switch to tablet → `/mat` → tap 5 check-ins → award a stripe to one student → sign off a skill.
5. Kiosk → search "Maya" → PIN → check-in → appears in the Mat roster.
6. Phone → login as `parent@ridgelinetkd.demo` → Home → see the stripe just awarded, attendance calendar,
   requirements progress; pay the open invoice with `4242 4242 4242 4242` → Desk shows paid.
7. Desk → Billing → AR aging → open a past-due invoice in dunning stage 2 → retry payment → recorded.
8. Desk → POS → sell a uniform (size from student record) → cash tender → receipt → inventory decremented.
9. Desk → Testing → "Saturday Belt Test" → auto-roster: 14 eligible, 6 almost (with named gaps) → invite →
   Home shows the invitation → register + pay fee → Desk roster confirmed.
10. Desk → CRM → drag a lead to Trial Scheduled → booking created → Convert → enrollment wizard → member.

**Part 2 — "…and five things Spark can't"**
11. **Ask Copilot**: "Which families are past due and haven't attended in 3 weeks?" → list with citations →
    "Draft a friendly SMS to them" → goes to Approvals (not sent) → approve → outbox/sent.
12. **Drift Detector**: dashboard "At risk: 7" → open → the seeded decaying student is #1 with the reasons
    → approve the drafted outreach.
13. **Action Board**: Mat → last night's session → "Record class" → (seeded recording) → board shows 9
    attendance confirmations, 3 skill notes, 1 injury flag → Approve all → attendance & sign-offs written.
14. **Natural-language report**: Reports → Ask → "attendance by program, last 8 weeks" → chart → save.
15. **Parent narrative**: Home → "This week" → plain-language progress summary for each child (approved by
    staff), and a technique submission with instructor-released AI feedback.

**Close:** Settings → Data export → download the ZIP. "You can leave any time. That's the point."

Exit criteria for the build: all 15 steps pass in the spec; screenshots committed; no step relies on a
fixture in the UI except AI steps when no key is present (in which case the UI shows the "dev fixture"
badge and the FINAL-REPORT says so).

---

# §7 HANDOFF — deploying the demo and live verification

Written for John, finalized in M5.09 as `docs/HANDOFF.md` with concrete values.

**Accounts you need (≈30 minutes):**
1. **Supabase project** (hosted): create → `supabase link --project-ref …` → `supabase db push` →
   `supabase db seed` (or `npm run db:seed -- --profile demo --remote`) → enable the custom access token
   hook in Auth → Hooks → set Site URL / redirect URLs to your domains → (optional) Google OAuth creds.
2. **Stripe** (test mode): platform keys → `.env`; Connect enabled; webhook endpoint
   `https://<host>/api/stripe/webhook` with the F7.8 events → signing secret → `.env`; a Terminal simulated
   reader for POS demo.
3. **OpenRouter**: key → `.env` (`OPENROUTER_API_KEY`); set a monthly budget.
4. **Resend / Twilio** (optional): keys → `.env`; otherwise messages sit in the Outbox by design.
5. **Vercel**: import repo → root `apps/web` → env vars from `.env.example` → domains `koryograph.ai`,
   `www.`, `desk.`, `app.`, `home.` → `vercel.json` crons deployed automatically → set `CRON_SECRET`.

**Live smoke test** (`npm run smoke:live` against the deployed URL; each step prints PASS/FAIL):
auth sign-in → tenant claim present → RLS matrix (two tenants) → Stripe: vault card, $1 charge, refund,
webhook received → OpenRouter: `ai:eval` (every task valid) → comms: send a real email to you → jobs:
trigger `billing_run` dry-run → export ZIP download.

**HANDOFF items** recorded during the build (from PROGRESS.md): anything that needed a key or network the
build didn't have, each with the exact command to verify it.

---

# Appendix A — Feature parity matrix

Legend: ● parity built · ◐ partial/P1 · ○ P2 · ★ differentiator. Sources: Spark Membership, Zen Planner,
Kicksite, Gymdesk public feature lists and reviews (2026).

| Capability (competitors) | KoryoGraph feature | Module | Milestone | Status target |
|---|---|---|---|---|
| Member management, profiles, notes, tags | F3.1–3.3 | core | M1 | ● |
| Family accounts / one payer, sibling discounts | F2.5, F7.3 | core/billing | M1/M2 | ● |
| Belt/rank tracking, testing eligibility | F4.1–4.4, F6.2 | core | M1/M3 | ● ★ (competency + multi-track) |
| Uniform & belt sizes | F4.6 | core | M2 | ● |
| Class scheduling, recurring, capacity | F5.1–5.2 | core | M1 | ● |
| Online booking, waitlists, cancellations | F5.4 | core | M1 | ● |
| Attendance: staff, kiosk, member app | F5.3 | core | M1 | ● |
| Makeups / class packs / drop-ins | F5.5, F5.9 | core | M1/M2 | ● / ◐ |
| Private lessons | F5.7 | programs_plus | M3 | ◐ |
| Recurring billing, autopay, contracts | F7.2–7.4 | billing | M2 | ● |
| Failed payment recovery (dunning) | F7.5 (+A8) | billing | M2/M4 | ● ★ |
| Invoices, receipts, refunds, credits | F7.6 | billing | M2 | ● |
| Member self-service payments / card update | F7.7 | home | M2 | ● |
| POS for retail, inventory | F8.1–8.3 | retail | M2 | ● |
| Purchase orders / receiving | F8.5 (+A6) | retail | M3/M4 | ◐ ★ |
| Online store | F8.6 | home | M5 | ◐ |
| Belt testing events, fees, registration | F6.1–6.3 | core | M3 | ● |
| Certificates | F6.6 | core | M3 | ● |
| Registry export (Kukkiwon etc.) | F6.5 | core | M3 | ◐ |
| Lead management / CRM pipeline | F3.4–3.6 | grow | M3 | ● |
| Trial offers & booking | F3.6, F11.1 | grow | M3 | ● |
| Email/SMS automations | F10.5 | grow | M3 | ● |
| Broadcasts / campaigns / segments | F10.6 | grow | M3 | ● |
| Two-way messaging | F10.3 | core | M1 | ● |
| Landing pages / funnels | F11.2 | grow | M5 | ○ |
| Referrals, reviews | F3.7, F11.3 | grow | M5 | ◐ |
| Digital waivers (versioned, minors) | F12.1 | core | M1 | ● |
| Document storage | F12.2 | core | M1 | ● |
| Events, camps, parties | F9.1, F9.2, F9.4 | programs_plus | M3 | ● |
| After-school programs | F9.3 | programs_plus | M3 | ● |
| Staff roles & permissions (custom) | F2.3 | core | M0 | ● ★ |
| Staff scheduling, time clock, payroll export, commissions | F13.2 | core | M3 | ◐ |
| Reporting dashboards | F14.1–14.2 | core | M1–M3 | ● |
| Custom report builder / scheduled reports | F14.3–14.4 | core | M5 | ○ |
| Member mobile app / PWA | F15.x | home | M1–M5 | ● |
| Multi-location | F1.9 | multi_location | M5 | ◐ |
| Website integration / booking widget | F11.1 | grow | M3 | ● |
| Integrations / API / webhooks | F1.8 | core | M5 | ● ★ (Spark weak here) |
| Data export / migration out | F1.7 | core | M1 | ● ★ |
| Data import from competitors | M5.03 | core | M5 | ● |
| AI copilot, churn prediction, class transcription, curriculum generation, NL reports, document intake, parent narratives, technique feedback | §2.5 | intelligence/vision | M4 | ★ (none of the competitors) |

---

# Appendix B — Gate scripts and guard tests

## B.1 `scripts/gate.ts` (behaviour)

```
usage: npm run gate -- <m0|m1|m2|m3|m4|m5|all>
1. Parse docs/build/PROGRESS.md → set BLOCKED = task ids in the "Blocked" table.
2. Steps (stop at first failure, print a summary table at the end):
   a. npm run typecheck
   b. npm run lint
   c. vitest run --project unit
   d. supabase db reset (fresh) && npm run db:seed -- --profile minimal && vitest run --project db
   e. npm run db:seed -- --profile demo && playwright test tests/e2e/m0 … tests/e2e/m<N>
      --grep-invert "@blocked:(<BLOCKED ids joined by |>)"   (only if BLOCKED non-empty)
      Specs needing keys are tagged @stripe / @ai-live / @email and are skipped when the key is absent;
      skipped-for-key specs are printed under "HANDOFF (not verified live)". Never counted as passes.
   f. for m4+: AI_TRANSPORT=fixture is forced for e2e; if OPENROUTER_API_KEY exists also run `ai:eval`.
   g. for m5/all: a11y.spec, security.test.ts, perf.test.ts, demo/alex-walkthrough.spec.ts
3. Exit non-zero on any failure. Write the summary to docs/build/gates/<milestone>-<timestamp>.md.
```

## B.2 Guard tests (`tests/db/guards.test.ts`) — SQL used

```sql
-- (a) RLS enabled everywhere in public
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;            -- expect 0 rows
-- (b) no RLS table without a policy
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);
-- (c) tenant tables have a tenant predicate
select t.table_name from information_schema.columns t
 where t.table_schema='public' and t.column_name='tenant_id'
   and not exists (select 1 from pg_policies p where p.tablename=t.table_name
                   and (coalesce(p.qual,'')||coalesce(p.with_check,'')) ilike '%app.tenant_id()%');
-- (d) tenant_id not null
select table_name from information_schema.columns
 where table_schema='public' and column_name='tenant_id' and is_nullable='YES';
-- (e) every FK column indexed (standard query over pg_constraint/pg_index)
```
Each query must return zero rows; the test prints offenders by name.

## B.3 ESLint honesty rules (`packages/config/eslint/honesty.js`)
`no-restricted-syntax`: `Identifier[name=/^(MOCK|FAKE|DUMMY|PLACEHOLDER)_/]`,
`Literal[value='placeholder-id']`, `JSXAttribute[name.name='dangerouslySetInnerHTML']`,
`CallExpression[callee.property.name='getSession']` (in `src/server/**`). `no-console` outside `scripts/`.

## B.4 Server-action guard test (`tests/unit/actions-guard.test.ts`)
Parses every file under `src/server/actions/**` and asserts each exported async function's first statement
calls `getCtx()` (or a `require*` helper that does).

---

# Appendix C — Seed data specification ("Ridgeline Taekwondo")

Deterministic (`seedrandom('koryograph')`, faker seeded). Fictional; no real school, names, or addresses.

- **Tenant**: Ridgeline Taekwondo (slug `ridgeline`), tz `America/New_York`, USD, theme `koryo-red`,
  location "Main Dojang" (2 rooms). Second tenant "Harbor BJJ" (minimal) for isolation tests.
- **Staff/users**: owner (Master Alex Kim — demo persona, not the real Alex), admin, 2 front desk,
  4 instructors, 1 assistant; certifications incl. one CPR expiring in 20 days. Password `KoryoDemo!2026`.
  Emails `<role>@ridgelinetkd.demo`, parent demo `parent@ridgelinetkd.demo` (Cooper household).
- **Programs & ladders**: Little Tigers (4–6; 8 ranks w/ 4 stripes), Youth Taekwondo (7–12; 10 gup + poom),
  Adult Taekwondo (13+; 10 gup + dan), Sparring Team (invite), Demo Team (invite). Skills library ≈120
  items across categories with rubrics; rank requirements (classes 16–40, days 60–120, 3–8 skills).
- **People**: ~250 students (age distribution 4–55, 60% under 13), ~120 households (30% with 2+ kids, 8
  split households), 180 guardians, 12 alumni, 15 on hold, 9 leads. Realistic name diversity. Photos:
  generated avatar placeholders (SVG initials), clearly not real people.
- **Schedule**: 28 weekly templates (Mon–Sat), capacity 12–24, holidays; sessions materialized for the
  past 24 months and next 90 days.
- **Attendance**: per-student behaviour profiles — steady (55%), improving (15%), decaying (12%: attendance
  velocity halves over the last 8 weeks → drift signals), sporadic (13%), new (5%). Overall ≈70% expected
  attendance; kiosk/mat/desk source mix.
- **Progression**: promotions consistent with attendance; current stripes; skill sign-offs; next Saturday
  testing event with ~14 eligible, ~6 almost (identifiable gaps), 3 registered & paid.
- **Billing**: 6 plans (Little Tigers $129, Youth $149, Adult $159, Family unlimited, Paid-in-full annual,
  2-week trial $29); memberships for all active students; 24 months invoices/payments; 4% failures; 7
  past-due across dunning stages; 3 on hold; credits; refunds; Stripe ids **only** when a key exists
  (else null and `method='cash|check|external'` for history).
- **Retail**: 40 SKUs (uniforms by size, sparring gear, belts, weapons, apparel), stock levels, 2 low-stock,
  180 POS sales history, 1 open PO.
- **Events**: summer camp (5 days, 22 registered), parents' night out, belt ceremony; after-school program
  (18 kids, 2 routes, 3 schools) with 60 days of attendance; one birthday party booked.
- **CRM/comms**: 9 leads across stages with UTM sources; 8 automations enabled with run history; 2
  broadcasts; 15 message threads; outbox samples in each status.
- **Documents**: waiver v1 signed by 92% of households, v2 published last week (so re-sign prompts exist);
  media release consents mixed; 5 uploaded documents.
- **AI**: KB (refund policy, make-up policy, testing FAQ, dress code, schedule digest); risk scores for all
  active students; pending approvals (3 drift, 1 action board, 1 doc intake, 4 narratives, 1 vision);
  one recorded class with transcript; `ai_runs` history; budget $50, used $8.40.

Invariants (`seed.test.ts`): every student in exactly ≥1 household; every attendance row references an
existing session and enrolled person; invoices balance = total − paid; no future attendance; ladder orders
contiguous; deterministic ids across two runs.

---

# Appendix D — PROGRESS.md template, commit conventions, FINAL-REPORT format

## D.1 `docs/build/PROGRESS.md`

```markdown
# KoryoGraph build progress
Branch: claude/pensive-mendel-rjoa9k · Started: <date> · Spec: KORYOGRAPH-BUILD.md v1.0

## Current task
M0.01

## Preflight
<paste of §0.9 output, keys present/missing>

## Milestones
| Milestone | Status | Gate result | Tag | Date |
|---|---|---|---|---|
| M0 | in_progress |  |  |  |

## Tasks
| Task | Status (todo/doing/done/blocked) | Commit | Notes |
|---|---|---|---|
| M0.01 | doing |  |  |

## Blocked
| Task | Diagnosis | Needs |
|---|---|---|

## HANDOFF items
| Item | Why | How to verify |
|---|---|---|

## Deviations (see DECISIONS.md for detail)
- ADR-0001 …
```

## D.2 Commit conventions
`<type>(<task>): <imperative summary>` — types: `feat, fix, chore, test, docs, refactor, seed, migrate`.
Examples: `migrate(M1.01): people, households, consents with RLS`, `feat(M1.08): mat roster with offline
check-in queue`, `test(M2.02): billing engine proration cases`. Body: what/why, acceptance run. Footer:
the attribution lines required by the session. Never include model identifiers in code or docs pushed.

## D.3 `docs/build/FINAL-REPORT.md`

```markdown
# KoryoGraph prototype — final report (<date>)
## Summary (5 lines, candid)
## What shipped — per milestone (feature ids → done/partial/not built)
## The Alex demo (§6) — step-by-step status with screenshot links
## Gate results — verbatim output of `npm run gate -- all`
## Blocked items — id, diagnosis, what's needed
## HANDOFF items — keys/services not verified live, with commands
## Known gaps vs §2 — honest list, ordered by impact on the Alex demo
## Recommended next 10 tasks
```

---

*End of KORYOGRAPH-BUILD.md v1.0. Wait for "go".*
