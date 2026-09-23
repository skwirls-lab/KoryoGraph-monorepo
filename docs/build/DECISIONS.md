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
