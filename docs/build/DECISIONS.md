# Architecture decision log

Append-only. Each entry: date, task, what the spec said, what was done, why.

---

## ADR-0001 — Consolidate to a single app; Supabase platform; OpenRouter for AI
- **Date / task:** 2026-09-22 · M0.02
- **Spec:** §1.4, §2.3, §3.1 — replace the five stub apps with one Next.js app (`apps/web`) using route
  groups per surface; Supabase for Auth/Postgres/Storage; all product AI through `packages/ai` → OpenRouter.
- **Decision:** Adopted as written.
- **Why:** One deployable, one auth session, one data layer. The previous multi-app split duplicated auth
  and let three apps render without any.

## ADR-0002 — Dev port 3100, working branch, Supabase CLI via npm
- **Date / task:** 2026-09-22 · M0.01
- **Spec:** §0.7/§0.9 assume `localhost:3000`, a globally installed Supabase CLI, and branch
  `claude/pensive-mendel-rjoa9k` (Appendix D template).
- **Decision:** `next dev -p 3100`; Supabase `site_url` and redirect URLs use `:3100`. The Supabase CLI is
  a pinned root devDependency (`supabase@2.117.0`) invoked through npm scripts. Work happens on
  `claude/koryograph-build` (the spec's branch is already merged into `main`).
- **Why:** Port 3000 is bound by an unrelated container on the build host. The CLI is not on PATH but the
  npm package ships the binary. A new branch keeps `main` clean.

## ADR-0003 — `@supabase/ssr` 0.12.x
- **Date / task:** 2026-09-22 · M0.01
- **Spec:** §3.1 pins `@supabase/ssr` ^0.5.
- **Decision:** Use the current 0.12.x line.
- **Why:** On a 0.x package, `^0.5` resolves only to 0.5.x, which is years stale against
  `@supabase/supabase-js` 2.117. The cookie adapter API (`getAll`/`setAll`) the spec relies on is the same.

## ADR-0004 — `packages/config` as one package; ESLint 9.39; `check` without turbo `test`
- **Date / task:** 2026-09-22 · M0.04
- **Spec:** M0.04 — rename eslint/typescript config packages (either `packages/config` or two renamed
  packages); `check` = `turbo run typecheck lint test`.
- **Decision:** Single `@koryo/config` package exporting `tsconfig/*.json` and `eslint/{base,next,honesty}`.
  ESLint pinned to 9.39.5 (npm flags it deprecated in favour of 10, but `eslint-plugin-react` 7.x used by
  `eslint-config-next` 16.3.5 is not ESLint 10-compatible). `check` = `typecheck && lint && test`, where
  `test` is `vitest run --project unit` from a single root Vitest config (projects `unit` and `db`) rather
  than a per-package turbo task — one runner, one config, same coverage.
- **Why:** Matches Appendix B.3's `packages/config/eslint/honesty.js` path; avoids a broken lint toolchain.

## ADR-0005 — Token contrast fixes, utility names, light-theme accent
- **Date / task:** 2026-09-22 · M0.05
- **Spec:** §3.10 — port the five themes unchanged; utilities "like `bg-surface`, `text-muted`,
  `border-default`, `bg-accent`"; §0.6 requires 4.5:1 contrast.
- **Decision:**
  1. `--text-muted` lifted in every theme (legacy values were ~2.5:1); dark theme accent moved from
     `#6366f1` to `#4f46e5` (white-on-accent was 4.47:1); new `--accent-text` token for accent-coloured
     text/links on dark surfaces (crimson `#e11d48` on `#121215` is 3.98:1 → `#fb7185`).
  2. The light theme uses the brand crimson (`#be123c`, 6.4:1 on white) instead of legacy indigo so
     Home (light by default) carries the KoryoGraph brand.
  3. shadcn owns the `muted`/`secondary`/`accent` colour names (`text-muted` would compile to the muted
     *background*). KoryoGraph text utilities are `text-fg`, `text-fg-secondary`, `text-fg-muted`;
     surfaces `bg-base|surface|elevated|panel`; brand `bg-brand`, `text-brand-text`; `border-default`
     exists; `bg-accent` is the subtle accent tint (shadcn semantics).
  4. Theme persistence is a `kg-theme` cookie (first paint correct on the server); `profiles.preferred_theme`
     sync is wired through `ThemeProvider.onPersist` once profiles exist. `next-themes` removed.
- **Why:** Accessibility is a stated requirement; the name collision was a real rendering bug.

## ADR-0006 — Composite tenant foreign keys; `job_runs.for_tenant_id`; policy generator shape
- **Date / task:** 2026-09-22 · M0.07
- **Spec:** §3.4 policy template; §4 conventions (`tenant_id not null` on tenant-scoped tables);
  §4.1 `job_runs.tenant_id null`.
- **Decision:**
  1. Every tenant-scoped table gets `unique (tenant_id, id)` and children reference parents with
     composite FKs `(tenant_id, parent_id) → parent (tenant_id, id)`. RLS alone cannot stop an insert
     from pointing at another tenant's row (FK checks bypass RLS); the composite key makes that impossible.
  2. `app.setup_tenant_table(tbl, write_perm, read_perm)` = RLS + standard policies + (tenant_id, id) key +
     updated_at trigger + audit trigger. `app.index_foreign_keys()` runs at the end of each migration so
     guard (e) holds by construction.
  3. `job_runs` is platform-level; its tenant reference is named `for_tenant_id` (nullable = all tenants)
     so guard (d) (`tenant_id not null`) stays meaningful. Platform admins read it; jobs write via service role.
  4. `role_permissions` carries `tenant_id` (the spec's §1.3 criticism of tables without it applies).
  5. `app.create_tenant` authorises on the JWT (`auth.uid()` = owner, platform admin, service role) or a
     direct superuser session (seed scripts) — `current_user` is useless inside `security definer`.
     Exposed to PostgREST as `public.create_tenant(name, slug, tz)` which always uses `auth.uid()`.
  6. New tenants start with a 14-day `trial` entitlement for **every** module (including core) and a
     "Main location"; onboarding edits it.
- **Why:** Tenant isolation must be enforced in the database, not by convention.

## ADR-0007 — `proxy.ts` (Next 16), verified claims via `getClaims()`, authorisation in layouts
- **Date / task:** 2026-09-22 · M0.08
- **Spec:** §3.3 — `middleware.ts`; "always authorize via `supabase.auth.getUser()`".
- **Decision:**
  1. Next 16 renamed middleware to `proxy.ts` (`middleware` is deprecated); the file is `apps/web/src/proxy.ts`.
  2. Request context reads claims through `supabase.auth.getClaims()`. For symmetric (HS256) projects it
     calls `getUser()` before trusting the payload; for asymmetric keys it verifies the signature via JWKS.
     Either way the claims are verified — `getUser()` alone does not return the hook-added claims
     (tenant_id, role, permissions, modules), which live only in the access token.
  3. The proxy handles host rewrites, request ids, session refresh and the unauthenticated redirect.
     Surface authorisation (`desk.access` …) is enforced in each surface layout via `requireSurfacePage()`,
     which calls `forbidden()` (Next `experimental.authInterrupts`) to return a real 403 page.
  4. `/auth/landing` is a page (not a route handler) so server-action redirects can target it.
- **Why:** Follow the framework's current conventions; keep authorisation next to the data it protects.

## ADR-0008 — People data split and Home visibility
- **Date / task:** 2026-09-22 · M1.01
- **Spec:** §4.2 `people.medical_notes` "(perm people.medical.read)"; `person_pins` with a household PIN
  used by the kiosk (M1.09); "every tenant table has the standard tenant policy".
- **Decision:**
  1. Medical notes live in `people_medical` (1:1 with people) readable only with `people.medical.read`;
     writes also need `people.write`. RLS is row-level — a column on `people` could not be hidden.
     Allergies and injury flags stay on `people` (instructors and the kiosk need them).
  2. Tenant-wide reads of people/households/members/consents require `people.read`. Parents and students
     are tenant users too, so the plain "same tenant" read would expose every family; Home users get an
     additive policy limited to `app.household_ids()` (households their linked person belongs to).
  3. PINs live in `kiosk_pins` keyed by household *or* person (staff clock-in in M3.06), bcrypt-hashed,
     never selectable by anyone; set through `set_household_pin()` (Desk with people.write, or a guardian
     of that household).
  4. Every view is `security_invoker` (guard test) so RLS applies through views.
  5. Every tenant table has an `id` (household_members too) so audit entity ids are meaningful.
- **Why:** Least privilege for minors' data; the database, not the UI, decides who sees a child's record.

## ADR-0009 — TanStack Table v8; people UI conventions
- **Date / task:** 2026-09-22 · M1.02
- **Spec:** §3.1 lists `@tanstack/react-table` unpinned; §0.6 "Tables: shared DataTable"; "Forms: react-hook-form + zod".
- **Decision:** Pin `@tanstack/react-table` 8.21.3 (v9.0 shipped 2026-08 with a new API; v8 is the mature,
  well-understood line). `DataTable` (packages/ui) renders; filtering, search and pagination are
  server-driven through URL state (`nuqs`, `shallow: false`) so lists are shareable and the server stays
  the source of truth. Multi-row writes that must be atomic go through `security invoker` SQL functions
  (`create_household`, `add_household_person`) — RLS still applies, and a family is created all-or-nothing.
  List CSV export needs only `people.read` (it's the same rows the user can already see) and is recorded
  in `audit_events`; the full-tenant export (M1.13) needs `exports.run`.
- **Why:** Stability over novelty mid-build; one table component; no partial families.

## ADR-0010 — Schedule templates in local wall-clock time; session key; jobs; schedule.manage
- **Date / task:** 2026-09-22 · M1.06
- **Spec:** §4.4 `class_templates.rrule text, dtstart timestamptz, until timestamptz`; `class_sessions`
  unique(template_id, starts_at); permission catalogue has no schedule-specific permission.
- **Decision:**
  1. Templates store `rrule` (body without DTSTART), `start_date`, `start_time` (local) and `until_date`;
     the timezone is the location's (else the tenant's). `packages/scheduling` expands rules in floating
     time and converts each occurrence to UTC with Intl — a 5 pm class stays 5 pm across DST.
  2. Sessions carry `occurrence_date` with unique(template_id, occurrence_date) as the materialiser's key,
     so a "modify" exception moves `starts_at` in place (spec's unique(template_id, starts_at) is kept too).
  3. `materialize_sessions` is diff-based and idempotent; it never deletes a session with attendance or
     bookings (cancels it instead) and leaves `detached`/completed sessions alone. Per-occurrence edits in
     the UI are written as schedule_exceptions so the job and the UI never disagree.
  4. Jobs: registry in `apps/web/src/server/jobs`, `job_runs` log, `/api/jobs/[name]` (GET for Vercel
     Cron, POST for tick/tests) with Bearer CRON_SECRET and `?now=` clock injection outside production;
     `npm run jobs:tick` calls due jobs through the same route (minimal 5-field cron in packages/scheduling).
  5. New permission `schedule.manage` (owner, admin, front desk); migration back-fills existing roles.
  6. rrule is imported through a namespace shim: its UMD main exposes only `default` under Node ESM (tsx).
- **Why:** Martial arts classes are wall-clock events; idempotent jobs are a stated NFR.

## ADR-0011 — Communications foundation pulled into M1.07; how messages are recorded
- **Date / task:** 2026-09-22 · M1.07
- **Spec:** M1.07 acceptance needs "a queued communication for a booked/enrolled person" on cancel; the
  communications tables/package are M1.11. §0.6: no service role on user request paths.
- **Decision:**
  1. Migration 0014 + `packages/comms` (system templates, merge-field rendering, consent + TCPA quiet-hours
     policy, lazy Resend/Twilio providers) land in M1.07; M1.11 adds inbox/outbox UI, overrides UI, webhooks.
  2. System templates live in code; tenants override per key+channel in `message_templates`.
  3. The Next server renders, applies the policy, sends via a provider when one is configured, then records
     the attempt with `record_communication()` — a security-definer RPC that checks the caller's tenant, the
     recipient's tenant, and (for Home users) that the template is one their own actions trigger. No direct
     insert policy exists. Statuses: sent / failed / unsent_no_provider (Outbox) / deferred (quiet hours,
     `scheduled_for`) / opted_out / no_address.
  4. Recipients are resolved by `message_recipients()` (guardians of minors, else the person), readable by
     roles with attendance.write or comms.send — so instructors can message a roster without people.write.
  5. Schedule edits re-materialise sessions with the staff member's own RLS client (the job function takes
     any Supabase client); the service role stays confined to the scheduled job route.
- **Why:** Honest Outbox behaviour without keys, consent enforced in one place, and no privilege escalation.

## ADR-0012 — Kiosk authentication by device token + definer RPCs
- **Date / task:** 2026-09-22 · M1.09
- **Spec:** F5.3 / M1.09 — "Pair this device" → `kiosk_devices` token cookie; PIN with lockout; §0.6 no
  service role on request paths.
- **Decision:** Pairing (staff with kiosk.manage) stores SHA-256(token) and sets the raw token in a 1-year
  httpOnly cookie, then signs the staff member out. The kiosk uses a sessionless anon client and seven
  narrow security-definer RPCs (`kiosk_info/search/family/unlock/sessions/check_in/check_in_confirmed`)
  that re-validate the token and act only inside the device's tenant and location. PIN failures are
  counted in `kiosk_unlock` (5 → 15-minute lock); `kiosk_check_in` re-verifies the PIN (stateless).
  Photo-confirm mode is an explicit per-device setting. Families without a PIN are sent to the desk.
- **Why:** A shared tablet must never hold a staff session or a privileged key.

## ADR-0013 — Bookings in definer RPCs; cross-household notices queued in the database
- **Date / task:** 2026-09-22 · M1.10
- **Spec:** F5.4/F5.5 — capacity, waitlist auto-promote with notification, makeup credits by tenant rule.
- **Decision:** `book_session` / `cancel_booking` are security-definer RPCs that lock the session row
  (race-free capacity) and authorise explicitly (staff with attendance.write, or a Home user for someone
  in their own household); Home users must respect the class cancellation window. A timely cancellation
  of a confirmed spot earns a makeup credit (`tenants.settings.makeups`, default on, 60 days). When a
  cancellation promotes another family's student, the notice is queued *inside the same transaction*
  (`app.enqueue_system_message` → `communications.status = 'queued'` + merge `data`), because the
  cancelling parent must not read the other family's contact details. The `outbox_dispatch` job (service
  role, every 5 min) renders, applies consent/quiet hours, and sends or marks `unsent_no_provider`; it
  also releases quiet-hours deferrals. Availability counts come from `session_taken()` (a count only).
  PL/pgSQL RETURNS TABLE names that equal column names need `#variable_conflict use_column`.
- **Why:** Correctness under concurrency, least privilege across households.
