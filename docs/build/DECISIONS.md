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

## ADR-0014 — Two-way messaging and inbound routing
- **Date / task:** 2026-09-22 · M1.11
- **Decision:** Households post to `message_threads`/`thread_messages` directly under RLS (own household,
  `from_staff = false`, as themselves); staff with comms.send post with `from_staff = true`. Unread counters
  and `last_message_at` are trigger-maintained; `mark_thread_read()` clears the caller's side. Staff replies
  also email the guardians via the `thread_message` template (Outbox when no provider). Inbound SMS maps to
  a tenant by `tenants.settings.sms_number` (the school's Twilio number) and to a family by phone; inbound
  email maps by a `reply+<threadId>@…` address. Webhooks verify Twilio HMAC-SHA1 and Resend/Svix HMAC-SHA256
  signatures and answer 503 when their provider is not configured (never a silent 200).

## ADR-0015 — Documents: safe text format, immutable signatures, storage layout, link signing
- **Date / task:** 2026-09-22 · M1.12
- **Spec:** F12.1 "rich text via a light editor — @tiptap/* acceptable"; PDF snapshot in `tenant-media`.
- **Decision:**
  1. Document bodies use a small safe text format (`# heading`, `- bullet`, paragraphs, `{{merge}}`) parsed
     into blocks rendered by React and by pdf-lib — no HTML storage or injection (the honesty lint bans
     `dangerouslySetInnerHTML`), and the PDF is guaranteed to match what was shown. A rich-text editor can
     be layered on later by serialising to the same format.
  2. Publishing an existing name creates version N+1 and deactivates earlier versions; signatures point at
     the exact version and are immutable (trigger), except for attaching the PDF path once.
  3. Storage bucket `tenant-media` is private; paths start with the tenant id. Staff with people.read/write
     use the tenant folder; Home users read/write only `<tenant>/households/<their household>/…`
     (signature PDFs). Downloads are 5-minute signed URLs issued under the caller's RLS.
  4. Signing links: staff create `signature_requests` (SHA-256 token) and email the link; completion runs in
     a definer RPC for anon callers; the `signature_pdfs` job (service role) renders PDFs for link/desk
     signatures and retries any that failed.

## ADR-0016 — Full export as a job, triggered on request
- **Date / task:** 2026-09-22 · M1.13
- **Decision:** "Export all data" (exports.run) inserts an `exports` row and immediately calls the
  `data_export` job route (Bearer CRON_SECRET, server-to-server), so the service role runs only inside the
  job; the minute-cron job picks up anything the trigger missed. The ZIP has one JSON array per
  tenant-scoped table (paginated past PostgREST's 1,000-row cap) plus the tenant record; hash/secret columns
  are redacted. Files live privately under `<tenant>/exports/` and download via 5-minute signed URLs.

## ADR-0017 — Demo seed loading strategy
- **Date / task:** 2026-09-22 · M1.14
- **Decision:** The demo profile bulk-inserts with deterministic ids (keys → `sid()`), a seeded PRNG and a
  seeded faker, with **user triggers disabled** for the load (seed data is not user activity: no audit rows,
  no per-row recounts); derived columns (`classes_since_promotion`, thread counters) are computed explicitly
  afterwards and checked by `tests/seed/demo.test.ts`. Sessions are generated with the same
  `packages/scheduling` code the nightly job uses, keyed by (template, occurrence date), so the job treats
  them as unchanged. Promotions/stripes/sign-offs are derived from the simulated attendance so progression
  is consistent. Signature PDFs are left to the `signature_pdfs` job (newest first). Counts are close to
  Appendix C (≈220 students, 130 households, 5 programs) rather than exact. Timeline is relative to "now",
  so ids are identical across resets on the same day.

## ADR-0018 — Stripe Connect Standard; ledger written from Stripe objects, never from the browser
- **Date / task:** 2026-09-23 · M2.03
- **Decision:** Platform-level keys; each school connects a **Standard** account (`tenants.stripe_account_id`)
  and every call carries `stripeAccount`, with an optional `application_fee_amount` from
  `STRIPE_PLATFORM_FEE_BPS`. The ledger is updated only from Stripe objects fetched server-side or delivered
  by a signature-verified webhook, through definer SQL functions (`app.record_payment_intent`,
  `app.record_payment_method`, `app.apply_refund`, `app.record_charge_refund`) that are idempotent: payments
  are keyed by PaymentIntent id, a settled payment never regresses, `charge.refunded` only records the
  difference between Stripe's `amount_refunded` and refunds already in the ledger. A succeeded payment is
  allocated to its invoice up to the balance; any remainder becomes household credit (`source_ref
  payment:<id>`); refunds reverse that credit first, then invoice allocations newest-first.
- **Consequences:** Desk card charges (off-session, idempotency key per dialog attempt) record the result
  immediately via the staff RPC, and the webhook later confirms the same intent without duplicates. Home
  users may call `record_payment_method` only for their own household's Stripe customer; the server passes
  the SetupIntent it re-read from Stripe. The webhook route and `server/admin/stripe/events.ts` are the only
  service-role paths; `stripe_events` gives exactly-once processing per event id (failed events stay
  unprocessed so Stripe's retry re-runs them). Unit tests run against a digest-pinned stripe-mock;
  the live `stripe.spec` needs real test keys plus a pre-onboarded connected account and is a HANDOFF
  until those exist.

## ADR-0019 — Enrollment: engine quotes, one atomic RPC; §4.7 gear tables brought forward
- **Date / task:** 2026-09-23 · M2.04
- **Decision:** The enrollment wizard previews and the server re-computes the first invoice with
  `packages/billing` (`firstInvoiceLines` → family discount via `familyDiscountPct` ranked against the
  household's live memberships → coupons → tax by class). `public.enroll_membership(p jsonb)` (billing.charge)
  then persists everything in one transaction: membership, invoice + lines (lines must sum to the total),
  coupon uses, program enrollments at each program's first rank, person status, gear fulfilment and any
  cash/check payment with its allocation. Card payments run after the transaction through the M2.03 charge
  path, so a decline leaves an honest open invoice rather than a half-created membership.
- **Gear:** `products`, `product_variants` and `gear_fulfilments` (§4.7) are created now because plans'
  enrollment kits need them; the rest of retail (inventory, suppliers, POS) stays in M2.08. Kits are
  included in the plan (no separate charge); sizes pre-fill from the student's uniform/belt sizes.
- **Contracts:** when a school has an active `contract` document, contract plans require a desk e-signature
  at enrollment (stored as a normal `signatures` row + PDF).

## ADR-0020 — Billing run and AR: SQL owns money state, the engine owns the math, tenant-local dates
- **Date / task:** 2026-09-23 · M2.05
- **Decision:** `billing_run` (daily 06:00 job, service role) runs per tenant with the Billing module:
  `billing_lifecycle(tenant, today)` applies date-driven transitions (cancel_at, expiries, holds on/off,
  past-due marking), then each due (membership, period) is priced by `packages/billing` (hold proration,
  family discount by rank over the household's live memberships, tax by class) and written by
  `billing_run_invoice`, which inserts the invoice and advances `next_bill_at` in one statement guarded by
  the unique `(membership_id, period_start)` — so re-runs, rewinds and concurrent runs can't double-bill.
  Coupons apply to the enrollment invoice only. Autopay charges go through Stripe only when it is
  configured and the school is connected; otherwise the run records "N autopay charge(s) not attempted"
  on `billing_runs.errors` (shown on the AR dashboard) and the invoices stay open.
- **AR operations** are definer RPCs (`record_manual_payment`, `apply_credit`, `add_invoice_line`,
  `void_invoice`, `record_refund(..., p_as_credit)`), each re-checking tenant, module and permission.
  Every refund gets a numbered credit note (`refunds.credit_note_number`, per-tenant counter); refunding to
  account credit creates a household credit that references it. Overpayments become credit.
- **Dates:** invoice status, aging and credit expiry use the school's local date (`app.tenant_today`), not
  the database's UTC `current_date`, which turned invoices past due on their due-date evening.

## ADR-0021 — Home wallet: browser pays, only Stripe's webhook writes the ledger
- **Date / task:** 2026-09-23 · M2.07
- **Decision:** Home "Pay now" creates an on-session PaymentIntent (setup_future_usage off_session) that
  the browser confirms with the Payment Element. Home users get no RPC that records a payment: a forged
  "succeeded" PaymentIntent could otherwise mark an invoice paid. The invoice becomes paid when the signed
  `payment_intent.succeeded` webhook arrives (the page shows "processing" and refreshes). Locally this needs
  `stripe listen`; the @stripe spec is skipped without it.
- Member-safe RPCs (`set_membership_autopay`, `mark_payment_method_detached`, `request_membership_hold`)
  check `app.can_manage_household_billing` (staff with billing.charge, or a member of that household).
  Removing a card detaches it at Stripe first; the RPC then turns off autopay on memberships using it and
  promotes another card to default.
- Hold requests create a row in `tasks` (§4.9, brought forward from M3.02, `source = 'request'`, structured
  `data`), shown on the Desk dashboard with "Apply hold"; staff can also hold/cancel/resume from the
  person's Billing tab. `/home/wallet?invoice=` (the dunning link) redirects to Billing with the invoice
  highlighted.

## ADR-0022 — POS: a sale is an open invoice until its tenders pay it
- **Date / task:** 2026-09-23 · M2.09
- **Decision:** The cart is priced on the server with the billing engine from catalogue prices (line
  discounts, tax by product class at the sale's location); `pos_open_sale` re-checks every unit price and
  that lines sum to the total, then creates an open `pos` invoice + sale. Each tender records a real
  payment against that invoice — cash (with change; needs an open drawer), check, other, account credit,
  card on file (Stripe, off-session) or Stripe Terminal (card_present; the simulated reader in test mode) —
  so split tenders and card declines never leave a half-paid sale unaccounted for. The tender that brings
  the balance to zero completes the sale: receipt number, stock out (`sale` movements), drawer link.
  Walk-in sales bill to one system household per tenant.
- **Returns** reference the original sale line (never more than sold), restock (`return` movements), take
  the returned amount off the original invoice first and then refund through `apply_refund` (numbered
  credit notes): cash back from the open drawer, account credit, or — for card payments — a Stripe refund
  made by the server and then recorded. Exchanges are a return plus a new sale.
- **Drawer:** expected = opening float + cash taken − change − cash refunds; closing records counted cash
  and variance. A fully refunded invoice now reads `refunded` even when its total became zero.

## ADR-0023 — Demo money seed and one MRR definition
- **Date / task:** 2026-09-23 · M2.11
- **Decision:** The demo profile's money is generated with the same engine the product uses: a membership
  per student from their status and dates (six plans), first invoices via `firstInvoiceLines`, monthly
  invoices with household family-discount ranking and hold proration, card autopay failures at ~4% of
  payments (older ones recovered by a retry, the last ~10 days still in dunning stages 1–3 with past-due/
  suspended memberships), refunds as numbered credit notes with the invoice credited, goodwill credits,
  40 SKUs with barcodes, ~440 POS sales with cash drawers (float + net cash = expected, small variances)
  and returns, enrollment kits delivered from stock, and restocks whenever an item would drop below 4.
  Everything is deterministic (seeded RNG, derived ids); derived columns (invoice paid/balance/status,
  household balances, stock levels) are recomputed after the trigger-less load and checked by the seed
  invariants, which also compare dashboard MRR and AR with the engine over the raw rows.
- **MRR** everywhere (dashboard, `v_mrr`, `v_mrr_monthly`) = recurring/contract memberships that are
  active, past due or suspended; memberships on hold are paused and don't count; trials never do.

## ADR-0024 — Automation events come from database triggers; one job runs everything
- **Date / task:** 2026-09-24 · M3.03
- **Context:** The spec sketches `emit('person.status_changed', …)` calls in server actions.
- **Decision:** Domain events are emitted by database triggers (membership created, lead stage changed,
  test invitation, payment failed via dunning state, promotion), which insert `automation_runs` for every
  active automation with that trigger. Scheduled triggers (absence N days, birthday, membership expiring,
  contract ending) are evaluated set-based in SQL by the `automations` job (every 5 min). The same job runs
  due runs: conditions (status, program, tag, consent) are checked once, then actions execute in order —
  send template (via the Outbox, so consent/quiet hours apply), wait N days (run pauses with `resume_at`),
  create task, notify staff (unassigned task), add tag — each logged on the run. Dedupe keys make every
  trigger fire once per person per streak/date/event.
- **Why:** triggers can't be forgotten by a new code path (imports, the POS, jobs, Home, SQL RPCs all
  emit), fire in the same transaction as the change, and keep execution in one trusted place. The demo seed
  loads with triggers disabled, so seeding doesn't spray automations.
- **Broadcasts** queue one message per recipient (guardians for minors, deduplicated) who has consent and an
  address for the channel; the preview counts exactly those, and shows who was excluded and why.

## ADR-0025 — Events: a day row for every event; guest links store only a hash
- **Date / task:** 2026-09-24 · M3.04
- **Decision:** every event gets `event_days` rows (one for a single-day event). Camp families choose days;
  capacity is counted per day (`register_for_event` locks the event row and counts non-cancelled
  registrations containing each chosen day), and check-in/out is always per day, so parties, seminars and
  camps share one check-in screen. Registration is one definer RPC for Desk and Home: the window, capacity,
  required waiver signatures and an allergy acknowledgement are checked in the database, the chosen option
  is priced there (`per person | day | week`, week = ceil(days/5)), and an `event` invoice is created;
  paying it flips the registration to `paid` by trigger (as for testing fees).
- **Check-out** requires a pickup name and a drawn signature (PNG in `tenant-media/<tenant>/events/…`,
  readable only with `events.manage`); authorized pickups are household guardians / can-pickup members plus
  `authorized_pickups`, and a name off that list is flagged to check ID rather than blocked.
- **Party guest waivers:** `party_guest_link()` generates the token in SQL and stores only its SHA-256, like
  signing links. The link is shown once; making a new one invalidates the old. Guests sign without an account
  through anon definer RPCs that only accept a valid, current token; anon can't read any event table.

## ADR-0026 — After-school bills through a weekly membership; absences alert from SQL
- **Date / task:** 2026-09-24 · M3.05
- **Decision:** each after-school program owns a `recurring` / `week` membership plan (created and re-priced
  by `save_afterschool_program` when Billing is on); enrolling a child creates an active membership on it
  (`next_bill_at` = start date), so the existing daily billing run produces the weekly invoices with the same
  idempotency, family discount, autopay and dunning as every other membership. Ending the enrollment sets
  the membership's `cancel_at`.
- **Absences:** marking a child absent (staff) or the `afterschool_cutoff` job (every 10 min: expected
  children with no school pickup after the program's cutoff, school-local) queues an `afterschool_absent`
  message to the guardians in the same transaction (`app.afterschool_alert`, once per child per day);
  the outbox job renders and delivers it with consent and quiet hours, or shows it in the Outbox with no key.
- **Manifest** is computed per date from enrollments (weekday, start/end) grouped by route then school,
  printable (Desk chrome hides in print). Release requires a name and a drawn signature, like camp check-out.

## ADR-0027 — Staff ops: kiosk PINs per staff member, commissions by trigger, payroll as a view
- **Date / task:** 2026-09-24 · M3.06
- **Decision:** staff clock in/out on the paired kiosk ("Staff clock" → name → 4-digit PIN) through
  device-token RPCs (`kiosk_staff`, `kiosk_staff_clock`), same model as family check-in: bcrypt hash in
  `staff_pins` (the hash column isn't selectable through the API), 5 wrong PINs lock that person 15 min,
  one open time entry per person (unique partial index). Managers add/approve manual entries and can clock
  someone out from Desk.
- **Commissions** are written by triggers, so no sale path can forget them: a POS sale reaching `completed`
  pays its cashier's `commission_pct` on the pre-tax amount (a completed return reverses it for the original
  cashier); a new membership pays its seller (`memberships.sold_by`, defaulting to the signed-in user) on one
  period's price. Imports/jobs have no seller and earn nothing.
- **Payroll** = `v_payroll` per school-local month: clocked hours × hourly rate + sessions taught
  (`v_instructor_sessions`: past, not cancelled; substitutes teach instead of the scheduled instructors) ×
  per-class rate + commissions. The Desk table and the CSV export read the same view.
- **Tasks** get a Desk queue (`/desk/tasks`: mine / unassigned / all / done); assignees without
  `people.write` can complete their own (RLS policy), others need `people.write`.
- Staff invitations (F2.4) remain in M5.02 (onboarding), per the plan.

## ADR-0028 — Growth report definitions
- **Date / task:** 2026-09-24 · M3.07
- **Trial funnel** (`v_trial_funnel`) groups leads by the school-local month they arrived and their source.
  A lead counts as "trial booked" / "attended" when it has the evidence (a trial booking, a
  `trial_booked`/`trial_attended` activity) or sits in a later stage (Offer or Won imply both), since leads
  can be moved along the board by hand.
- **Retention cohorts** (`v_retention_cohorts`) use memberships that represent ongoing membership
  (recurring, contract, paid-in-full; not trials, drop-ins or class packs). Cohort = month of a person's first
  such membership; month *k* counts people holding one on the last day of that month (today for the current
  month). A cancelled membership ends at `cancel_at`, else `ends_at`, else when it was last updated.
- **Churn list** shows each cancelled/expired membership with reason and tenure, flagging people who are
  still members through another membership; the reason summary counts only those who actually left.
- All growth views are `security_invoker`: a reader sees only what their own permissions allow (the tests
  check a parent sees nothing, and sees no one else's money behind member-visible events).

## ADR-0029 — Demo seed v3 choices
- **Date / task:** 2026-09-24 · M3.08
- The camp is an upcoming **Fall Break Camp** (Appendix C says "summer camp"): the seed is date-relative and it's
  autumn, so an upcoming camp demonstrates registration and day check-in; past summer camp history would need
  fabricated pickup signatures, which the seed doesn't create.
- The belt test uses Youth Taekwondo, whose eligibility engine output on the demo data is **14 eligible** (as
  the demo script says) and currently 17 "almost" (Appendix C says ~6). The seed doesn't reshape training
  history to hit a number; the M5 demo spec reads the counts from the engine.
- Historical rows that live UI would have produced with a signature image (after-school releases) carry the
  pickup name and times but no signature path — the seed never invents signature images.
- Broadcasts and automation messages in the history are `unsent_no_provider` (the Outbox), as they would be on
  a server without email/SMS keys; nothing claims to have been delivered.

## ADR-0030 — AI gateway: models per deployment, fixtures never invent answers
- **Date / task:** 2026-09-25 · M4.01
- **Model tiers are environment-only** (`AI_MODEL_FAST|FRONTIER|VISION|AUDIO|EMBED`). M4.01 asks for default
  picks recorded here, but the build conventions (Appendix D.2) forbid model identifiers in pushed code and
  docs, and this environment has no OpenRouter key to verify the current catalogue. So no defaults ship: a
  live call to an unset tier fails with `no_model`, Settings → AI shows each tier as "not set", and choosing
  models is a deploy-time step (HANDOFF). Prices come from the provider catalogue (`ai_models_sync` job) or
  from OpenRouter's usage accounting on each response.
- **Transport:** `AI_TRANSPORT=live|fixture`, or unset = live with a key, recorded fixtures without.
  Fixtures are refused in production (a production server without a key says "no key"). The gate verifies
  the e2e server is in fixture mode (`/api/health`). Fixtures replay only recorded inputs
  (`tests/fixtures/ai/<task>/<hash of the task's fixture key>.json`); an unrecorded input fails with
  `no_fixture` rather than returning a made-up answer, and every fixture answer is badged "dev fixture".
  Fixtures in this repo are hand-authored to the task schemas (no key) and say so in a `note`; `npm run
  ai:record` replaces them when a key exists. Fixture embeddings are a deterministic hashed bag of words
  (lexical, clearly not semantic).
- **Every run is logged** (`ai_runs`: ok or not, live or fixture, tokens, cost, attempts) through
  `log_ai_run` as the signed-in user, or by jobs with the service role; the budget (`tenant_ai_budgets`,
  default $50/month) is checked against this month's spend plus the task's cost ceiling before any call.
- Tenant bring-your-own keys (optional in the spec) are not built: the platform key is the only key.

## ADR-0031 — Knowledge base: model-tagged vectors, hybrid search, fixture vectors in seeds
- **Date / task:** 2026-09-25 · M4.03
- `kb_chunks.embedding` is an untyped pgvector column plus `embedding_model` (the spec's `vector(1536)`
  assumes one embedding model; here the model is a deployment choice). `public.kb_search` (security invoker,
  so RLS applies) only compares a query vector with chunks from the same model and dimension, fuses that
  ranking with full-text rank (RRF, k=60), and still returns text matches when there's no query embedding —
  so the KB works, honestly degraded, without a key. At this size brute-force cosine is fine; no ANN index.
- Documents have an audience (`everyone` | `staff`): families (and the Home assistant) only ever see
  `everyone` documents, enforced by RLS.
- Seeded KB documents are embedded with the deterministic fixture embedding and labelled "dev fixture
  vectors" in Settings; "Re-index" with a key replaces them with real embeddings.

## ADR-0032 — Copilot: structured tool steps with grounded placeholders; private conversations
- **Date / task:** 2026-09-25 · M4.04
- The Desk copilot is a loop of structured-output steps (`copilot_step`): each step is either a typed call to
  one read-only tool (find_person, person_summary, attendance_summary, invoices_for_household, run_report,
  kb_search, propose_action) or the final answer. This keeps every model response schema-validated (retry
  once, then fail) and lets fixtures replay whole conversations. Tools run as the signed-in staff member, so
  RLS and permissions bound what the copilot can see; `propose_action` only creates a `copilot_write`
  approval item.
- **Numbers are grounded:** answers quote tool results through `{{obs.N.path}}` placeholders that the server
  fills from the actual observations (`renderGrounded`); unfillable ones render as "[unknown]" and the answer
  says so. A fixture answer to "How many students are past due?" therefore shows today's AR numbers.
- Steps stream to the browser as NDJSON (tool steps as they run, then the answer) from a route handler.
- **Home assistant** gets only family-visible KB chunks (RLS) and the caller's own household facts; it can't
  reveal other families because it never receives their data. Low confidence / out-of-scope → "Message the
  front desk" opens an ordinary thread.
- Conversations are private to their user (no staff override); the audit trigger records who/when but strips
  message text, citations and titles.
- Fixtures for 6 copilot prompts and 2 Home questions are hand-authored (`scripts/fixtures/author-copilot.ts`);
  any other question in fixture mode gets an honest "not one of the recorded dev examples" reply.

## ADR-0033 — Action Board: consent backstop in SQL, ffmpeg-static, atomic execution
- **Date / task:** 2026-09-25 · M4.06
- Recording a class requires AI-processing consent for every minor on the roster. The Mat UI lists who's
  missing and switches to typed notes; a `before insert` trigger on `class_recordings` refuses audio
  recordings regardless of the UI.
- Browser recordings (WebM/Opus) are converted to 16 kHz mono MP3 with `ffmpeg-static` (a pinned binary
  dependency; the host has no system ffmpeg) because audio-capable chat models take WAV/MP3.
- The model's board is checked against the class's real roster and skills: rows about unknown people or skill
  ids are dropped and counted, sign-offs need a real enrollment, and rows under 0.7 confidence start
  unticked so they need an explicit tick.
- Approving a board runs `execute_action_board` — one transaction, at most once, from the approved payload.
  It needs ai.approve + attendance.write, and it's the board (not a general permission) that lets an
  instructor create the follow-up task and notes. A failure is shown plainly ("Approved, but it couldn't be
  saved: …") instead of half-writing.
- The test/demo class audio is a 1-second tone whose recorded fixture transcript is the scripted class notes
  (dev fixture); live transcription replaces it when a key exists.

## ADR-0034 — NL reports: schema `nl`, role `nl_reader`, two independent guards
- **Date / task:** 2026-09-25 · M4.09
- Model-written SQL runs only through `public.run_nl_report`, which switches to the role `nl_reader` for the
  statement (read-only transaction, 5 s timeout, ≤ 5000 rows, json rows in column order). `nl_reader` can
  select only the views in schema `nl`; `authenticated` may `SET ROLE nl_reader` but doesn't inherit its
  privileges (`WITH INHERIT FALSE`).
- The `nl` views read through security-definer row functions (the existing report views are
  `security_invoker`, which would otherwise need base-table grants for `nl_reader`); each function returns
  only the caller's tenant and only if they hold the relevant permission (reports.read / billing.read /
  crm.manage / people.read).
- Because the RPC is reachable directly over the API, the database repeats the essential checks: a single
  SELECT/WITH, and no `set_config` / `current_setting` / `pg_*` / large-object / dblink / xml / unicode-escaped
  identifiers — otherwise a query could rewrite the JWT claims the tenant filter reads. The TypeScript
  validator (`validateReportSql`, unit-tested) is stricter still: allowlisted views and functions only,
  no comments or quoted identifiers, LIMIT ≤ 5000.
- Charts use recharts with the chart palette re-stepped to pass the dataviz checks (lightness band, chroma,
  CVD, contrast) on light and dark surfaces: teal `#0d9488` and amber `#d97706` replaced the lighter green and
  amber. Multi-series charts always have a legend and the table below them.

## ADR-0035 — Growth agents: rule-based lead score, approval-first narratives, opt-in billing recovery
- **Date / task:** 2026-09-25 · M4.10
- **Lead score (A10)** is a transparent, unit-tested formula (`scoreLead`: trial booked/attended, offer stage,
  referral/web source, message, touches, staleness, age) rather than a model output, so staff can see why a
  lead ranks where it does and the number never changes from a re-roll. The model only suggests the next
  step, stored in `leads.ai_next_action` beside (never over) the staff-owned `next_action`; the board shows the
  suggestion only when staff haven't set one. Leads are rescored when changed since `scored_at` (compared in
  the job: PostgREST can't compare two columns).
- **Parent narratives (A9)** are always drafts: the weekly job drafts one per minor who trained, got a
  sign-off or was promoted in the last 7 days; nothing reaches `home_updates` (read by the household via RLS)
  until someone with `ai.approve` approves — edits included — in the queue (batch approve up to 200). The
  model writes placeholders (`{{student}}`, `{{classes}}`, `{{skills}}`, `{{promotion}}`) that the job fills with
  the week's real facts, so a draft can't invent attendance or ranks.
- **Billing recovery (A8)** is off by default (`tenants.settings.ai.billing_recovery`: off / approve / auto).
  In approve mode each dunning notice becomes a tone-adjusted draft in Approvals instead of the template; auto
  sends without review only after the school has approved at least one such draft. Any AI failure (no
  fixture, budget, provider) falls back to the standard template, so a family is never left un-notified.
- The approvals page now filters by kind in the query and counts from all pending items: a weekly batch of
  narratives must not hide other kinds past the 200-row page.

## ADR-0036 — Technique feedback and schedule suggestions; fixture visibility for reviewers
- **Date / task:** 2026-09-25 · M4.11
- **Clips upload straight to storage** from the browser (≤ 50 MB, ≤ 60 s) under `<tenant>/technique/<person>/`,
  which storage RLS limits to the family's own students; the server action then registers the path through
  `submit_technique` (household, folder, duration and "≤ 3 waiting" checks). Server actions are capped at
  12 MB, too small for phone video. The job re-measures the clip with ffmpeg and extracts 6 evenly spaced
  keyframes from a temp file (phone MP4s aren't streamable from a pipe).
- **Nothing reaches the student before an instructor**: the AI draft lives only in the `vision_feedback`
  approval item; `release_technique_feedback` copies the (possibly edited) feedback onto the submission
  atomically. Rejecting ("send back") records the reason for the family. The overall score is computed from
  the rubric weights, not written by the model, and is recomputed when the instructor edits scores.
- **Minors' consent**: a before-insert trigger refuses a submission for a minor without a current
  `ai_processing` consent (also for staff and the service role). The Home consent policy was tightened: a
  household member may record consent only for a student in a household where they are a guardian, or for
  themselves if an adult — previously a teen could consent for themselves.
- **Reference clips**: curriculum writers may upload a skill's "gold standard" clip; its 4 keyframes are
  extracted once and sent alongside the student's frames.
- **Schedule suggestions** are chosen from the numbers (`schedule_stats`, last 4 weeks: utilization vs
  capacity, waitlists, no-shows) by a unit-tested rule (`scheduleCandidates`); the model only words them, with
  placeholders filled from the real stats, and plain wording is used when AI is unavailable.
- **Fixture visibility**: `ai_runs` is readable only with `settings.manage`, so instructors and other
  approvers didn't see the "dev fixture" badge on drafts (action boards, intake, approvals). Reviewed rows
  now carry `ai_transport`, copied from the run by trigger.
- **Test clip**: `tests/fixtures/video/clip-6s.mp4` is a synthetic ffmpeg test pattern, not footage of a
  person; its feedback fixture is hand-authored and always labelled "dev fixture".
- Toasts lost Sonner's `richColors` (their text failed WCAG contrast) and got a 24 px close target;
  status colour is carried by the icon.

## ADR-0037 — Demo seed v4: AI data from the product's own code paths, pinned to fixtures
- **Date / task:** 2026-09-25 · M4.12
- The M4 demo data is not inserted as rows: the seed runs the real jobs (`kb_schedule_digest`, `drift_score`,
  `lead_scoring`, `schedule_suggestions`, `parent_narratives`, `transcribe`, `technique_feedback`) and the real
  intake drafter and approval executor, signed in as the demo instructor / owner / parent under RLS. It runs in a
  child process with the `react-server` condition because those modules are `server-only`. AI is pinned to
  `AI_TRANSPORT=fixture` in that process so the demo is deterministic and never makes a paid call; everything
  it produces carries the "dev fixture" label.
- **Differences from Appendix C**, all because the data comes from real behaviour rather than being typed in:
  - **Drift drafts:** 7 pending instead of 3, one per high-risk student.
  - **Narratives:** ~120 pending instead of 4. The weekly job drafts one for every active minor who trained;
    Maya's and Leo's are approved.
  - **AI usage:** $0.00 used instead of $8.40. Fixtures cost nothing, and inventing spend would break the
    honesty rules.
- The recorded class uses the most recent Youth Taekwondo — Advanced session, whose rank-banded roster
  holds the ten students named in the fixture transcript (`tests/fixtures/demo-class.ts`). The three minors on
  that roster without AI-processing consent get paper consents recorded by the owner, because the database
  refuses the recording otherwise. The audio is a synthetic tone, like the M4.06 spec's.
- Riley's drift story is shaped explicitly: attendance in the last 26 days is removed and an injury note is
  added 27 days ago. This happens after the bulk load, so the rest of the random school is unchanged.
- Seed invariants now cover this state: Riley #1, one pending board reading 9 / 3 / 1, pending approvals of
  each kind, all fixture-labelled, Maya's released feedback with 3 tips, and Home updates for the Cooper
  family.

## ADR-0038 — Public site: prices in the database, honest placeholders
- **Date / task:** 2026-09-25 · M5.01
- Module prices live on `modules` (`monthly_cents`, `annual_cents`, `price_note`), using the spec's suggested
  prices; annual is 10× monthly, like the plans. `/pricing` and the landing page read `plans`/`modules`
  anonymously, so the business changes prices in data, not code. The module picker's total and its "bundle is
  cheaper" hint come from a unit-tested `quote()`.
- Testimonials are omitted: there are no customers to quote. `/privacy` and `/terms` are plain-language
  drafts marked "Draft — legal review pending".
- `/contact` writes to `contact_messages` through a rate-limited, honeypotted RPC. Platform admins can read it
  via RLS; there is no admin inbox UI or email notification yet (HANDOFF).
- A plan chosen on the site (`/signup?plan=…`) is carried through sign-up, including the email-confirmation
  path, and stored as `tenants.settings.plan_choice` for "Go live" to preselect.

## ADR-0039 — Onboarding: steps derived from real data; invites via Supabase Auth; go-live without platform billing
- **Date / task:** 2026-09-25 · M5.02
- Each wizard step counts as done when the real data exists: a location with an address, programs with
  ranks, an active class, a student, a connected Stripe account, a second staff member (active or invited),
  saved branding, or the school being live. "Skip for now" is recorded and always shown as "Skipped". New
  schools already have a default Taekwondo ladder, so "Programs" starts done.
- **Staff invites:** Supabase Auth creates the user and sends the email (locally Mailpit; production uses
  the project's SMTP — HANDOFF). This needs the service role, so it lives in `server/admin/invites.ts`. The
  membership waits as `invited` until the person signs in and accepts on `/welcome`.
  - Supabase invite links carry the session in the URL fragment, not as a PKCE code, so they land on
    `/auth/accept`. That client page stores the session and continues.
  - Found by the spec: before this, invite links failed with `missing_code`.
- **Go live** (`go_live` RPC) makes the chosen plan's modules the school's entitlements (or a custom set,
  always with core), ends the trial, and records the plan. Charging for the KoryoGraph subscription itself is
  not connected, and the UI says so; the platform's Stripe Billing is HANDOFF.
- **Branding:** a school default theme for its staff surfaces (a person's own choice still wins; Home stays
  light) and a logo in the Desk, Mat and Home headers.
- `audit_events.action` only allows create / update / delete / custom, so these events are `custom` with the
  specific action in `note`.

## ADR-0040 — CSV importer: normalized rows, atomic chunks, rollback by recorded entities
- **Date / task:** 2026-09-25 · M5.03
- **Validation in the app:** the app parses the CSV (papaparse), applies the column mapping and validates
  every row. It reads US and ISO dates and statuses, and resolves program, rank and plan names to ids,
  accepting short rank names like "Yellow belt" for "Yellow belt (9th gup)". A dry run shows new vs. already
  here, plus errors and warnings by line; rows with errors are skipped.
- **Commit:** `import_rows` applies chunks of 50 atomically as the signed-in user (RLS), and the page shows
  progress.
  - People are matched by external id, then by name + date of birth, so re-importing a file changes nothing.
  - Siblings join their guardian's household, matched by guardian email.
  - Memberships attach only to existing plans, with billing from the next billing day — nothing is
    back-billed.
- **Rollback:** every row an import creates is recorded in `import_entities`, and `rollback_import` deletes
  them. Updates the import made to people who already existed are not undone.
- **Presets:** Spark / Zen Planner / Kicksite column names are assumptions about those vendors' exports, not
  verified against their software. The mapping screen always shows the result so the school can fix any
  column.
- **AI assist:** the mapping assist sends only header names and value shapes (email / date / number…, fill
  rate) — never cell values, so no student or family data leaves for the AI provider.
- **Deviation — attendance:** the spec lists attendance as a target. Individual historical check-ins are not
  imported, because KoryoGraph attendance needs a real class session. What eligibility needs — "classes since
  last promotion" — is imported onto the enrollment.

## ADR-0041 — Public API: keys resolved and scoped inside the database; signed webhooks with retries
- **Date / task:** 2026-09-25 · M5.04
- **Keys:** `kg_live_<8>_<32>`, stored only as SHA-256. `/api/v1/*` uses the anon client (no service role)
  and calls the security-definer `api_list`. The function hashes the key, finds its school and scopes,
  counts the request against a 120/min limit (`app.api_rate`, an unexposed table), and returns that school's
  rows through explicit column lists. Tenant isolation is therefore enforced in SQL, not in the route.
- **API shape:** read-only in v1 — people, attendance, invoices, memberships — with keyset pagination
  (`next_cursor`) and filters. OpenAPI 3.1 is served at `/api/v1/openapi.json`.
- **Webhooks:**
  - Triggers queue `member.created`, `attendance.created` and `invoice.paid` for each active, subscribed
    endpoint. Seed bulk-loads run with triggers off, so they queue nothing.
  - The `webhook_dispatch` job POSTs with `KoryoGraph-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")` and
    retries after 1 min, 5 min, 30 min, 2 h and 12 h before marking a delivery failed.
  - In production it refuses non-https and internal destinations: localhost, private and link-local ranges,
    `.internal` / `.local`.
  - DNS rebinding (a public name resolving to a private address) is not defended against yet; this is noted
    for the security review.

## ADR-0042 — Home PWA: offline shell only; in-app notifications; web push only with VAPID keys
- **Date / task:** 2026-09-25 · M5.05
- `app/manifest.ts` makes Home installable: start `/home`, standalone display, 192/512 icons plus a maskable
  icon (a simple generated mark). The service worker (`public/sw.js`) caches only `/offline`. It never caches
  school data: Home navigations go to the network and fall back to the offline page. It also displays pushes
  and opens Notifications on click.
- **Notifications:** `/home/notifications` lists delivered (`sent`) in-app messages. Families mark them read
  through `mark_notifications_read`, since they can't update communications directly. An unread badge sits
  in the Home header. In-app messages now keep their subject so they have a title.
- **Web push:** subscriptions (own rows only) and sending (`web-push`, from the outbox job) happen only when
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are set. Without them the page says push isn't set up
  and notifications stay in-app. Live push is HANDOFF: it can't be verified without keys and a real push
  service.
- Chrome's Lighthouse no longer has a PWA category (removed in v12). The spec checks the installability
  criteria directly: a valid manifest with PNG icons, a service worker controlling the page, and working
  offline behaviour.
