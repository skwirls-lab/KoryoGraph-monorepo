# KoryoGraph prototype — final report (2026-09-23)

Branch `claude/koryograph-build` · tags `m0-complete` … `m5-complete`, `v0.1.0-prototype` · spec KORYOGRAPH-BUILD.md v1.0

## Summary
1. All 71 planned tasks (M0.01–M5.11) are done. `npm run gate -- all` is **GREEN** at `7e3f6f8`: unit 232, billing coverage 76 (100% branches), db 147, seed invariants 15, e2e 109, the §6 walkthrough, bundle scan and npm audit.
2. **Nothing external has been verified live.** No Stripe, OpenRouter, Resend, Twilio or VAPID keys were provided, and the Stripe CLI isn't installed. Those paths are real code with tests against stripe-mock and fixtures, but the `@stripe`, `@ai-live` and `@email` specs were skipped and are not counted as passes.
3. **Every AI result in the running UI is a hand-authored dev fixture**, labelled "dev fixture" in the app, because there is no OpenRouter key. §6 allows this, but the AI layer's real quality is unknown until `npm run ai:eval` runs with a key.
4. **The Alex demo runs end to end: 22 steps PASS and 4 are HANDOFF.** Card payment on Home, the dunning card retry, the testing fee by card and sending the SMS all need keys. In each case the UI says so honestly and a real non-card path (check or cash payment, the Outbox) is used instead.
5. **P0 features are built; the P1/P2 long tail is mostly not.** Not built: 2FA, impersonation, referrals, @mentions, the Home pro shop, e-sign contracts, custom report builder, custom domains, sales tax and platform subscription billing. One security finding is open: F4, DNS rebinding on outbound webhooks.

## What shipped — per milestone
Status legend: **done** means built and covered by a gate test. **partial** means some of it is built and the gap is named. **not built** means nothing was built.

**M0 foundation.** Monorepo; local Supabase; design system; auth with a custom access-token hook; RBAC; audit; signup → tenant; gate; CI.
- F1.1 tenant **done**
- F1.3 self-serve signup **done**
- F1.5 entitlements (modules enforced in data) **done**
- F1.6 audit log **done**
- F2.1 Supabase Auth **done**
- F2.2 token hook **done**
- F2.3 RBAC **done**

**M1 core studio.**
- People and households:
  - F2.5 households **done**
  - F2.6 people without logins **done**
  - F2.7 COPPA (consent is recorded; minors' media is gated on consent) **done**
  - F3.1 single `people` record **done**
  - F3.2 lifecycle status **done**
  - F3.3 member profile **done**
- Programs, rank and curriculum:
  - F4.1 programs **done**
  - F4.2 requirements per rank **done**
  - F4.3 curriculum library **done**
  - F4.4 student progression **done**
  - F4.5 lesson plans **done**
  - F4.6 uniform/belt sizes **done**
- Scheduling and attendance:
  - F5.1 recurring class templates **done**
  - F5.2 calendar views **done**
  - F5.3 attendance (Mat and Kiosk) **done**
  - F5.4 bookings and waitlist **done**
  - F5.5 attendance rules per membership **done**
  - F5.6 attendance analytics **done**
  - F5.7 private lessons **partial**: slots are in the schema but there's no polished booking flow
  - F5.8 substitutes and instructor class counts **done**
  - F5.10 door access / QR check-in **not built**
- Communications:
  - F10.1 provider abstraction **done**
  - F10.2 transactional templates **done**
  - F10.3 messaging **done**
  - F10.4 consent **done**
- Documents and compliance:
  - F12.1 waivers and agreements **done**
  - F12.2 document vault **done**
  - F12.3 compliance dashboard **done**
- F14.1 owner dashboard **done**
- F14.2 report library **done**
- F1.7 export **done**

**M2 money.**
- Billing:
  - F7.1 ledger-first **done**
  - F7.2 membership plans **done**
  - F7.3 household billing **done**
  - F7.4 autopay: the engine is **done**; card charges are HANDOFF
  - F7.5 dunning: **done**; the card retry is HANDOFF
  - F7.6 Desk billing **done**
  - F7.7 Home wallet: the UI is **done**; card entry is HANDOFF
  - F7.8 Stripe webhooks: **done** against fixture events; live is HANDOFF
  - F7.9 accounting export **done**
  - F7.10 revenue reports **done**
  - F7.11 surcharges and sales tax **not built**
- Retail:
  - F8.1 products with variants **done**
  - F8.2 inventory per location **done**
  - F8.3 POS: cash and check **done**; Terminal and card-on-file are HANDOFF
  - F8.4 gear packages **done**
  - F8.5 purchase orders and receiving **done**
  - F8.7 barcode label printing **not built** (scanning works; printing labels doesn't)
- F15.4 Home wallet and billing **done** (card entry is HANDOFF)

**M3 growth and operations.**
- Testing and promotion:
  - F6.1 testing events **done**
  - F6.2 auto-roster with "almost" gaps **done**
  - F6.3 scoresheets **done**
  - F6.4 one-tap stripes **done**
  - F6.5 registry export **done**
  - F6.6 certificates **done**
  - F6.7 belt-inventory reservation **not built**
- CRM:
  - F3.4 lead capture **done**
  - F3.5 pipeline board **done**
  - F3.6 trials **done**
  - F3.7 referral program **not built**
  - F3.8 birthday and milestone automations **done** (automation triggers)
  - F3.9 notes, tasks and @mentions **partial**: notes and staff tasks work, @mentions don't exist
  - F11.1 public lead form and trial widget **done**
- F10.5 automations **done**
- F10.6 broadcasts **done**
- Events and programs:
  - F9.1 events **done**
  - F9.2 camps **done**
  - F9.3 after-school **done**
  - F9.4 birthday parties **done**
  - F9.5 private lessons: see F5.7
- Staff:
  - F13.1 staff profiles **done**
  - F13.2 time clock **done**
  - F13.3 tasks **done**
  - F13.4 instructor scorecards **not built**
- F14.2 growth reports **done**
- Marketing, compliance and reporting extras:
  - F11.2 landing page builder **not built**
  - F11.3 review requests **partial** (an automation step type only)
  - F12.4 contract e-sign **partial**: documents are e-signed, but there's no membership-contract flow
  - F14.3 saved filters, scheduled delivery and KPI targets **partial**: NL reports can be saved; there's no scheduled delivery and no targets
  - F14.4 custom report builder **not built**; NL reports cover part of that need
  - F4.7 demo-team choreography **not built**

**M4 intelligence.**
- AI gateway: tiered models, budgets, `ai_runs`, and fixture/live transports.
- Approval queue and knowledge base (RAG).
- Agents A1–A12, all **done** on fixtures and **HANDOFF** for live:
  - A1 Desk Copilot
  - A2 Home Assistant
  - A3 Drift Detector
  - A4 Post-class Action Board
  - A5 lesson builder
  - A6 document intake
  - A7 NL reports
  - A8 billing recovery
  - A9 parent narratives
  - A10 lead scoring (rule-based score; the AI suggests the next step)
  - A11 technique feedback (the `vision` module)
  - A12 schedule suggestions
- Demo seed v4 produces its AI content by running the real jobs and actions.

**M5 product surface.**
- F1.3 public site and pricing **done**; F1.4 onboarding wizard **done**. Hosted by-email invites need SMTP (HANDOFF).
- CSV importer **done**:
  - the Spark, Zen Planner and Kicksite presets are assumptions;
  - only the attendance count is imported, not the history.
- F1.8 public API v1 and signed webhooks **done**. F4 (DNS rebinding) is open.
- F15.6 installable PWA **done**; F10.7 push: in-app **done**, web push is HANDOFF (no VAPID keys).
- F1.9 multi-location **done**: location switcher, rollup, and staff scoping enforced in RLS.
- Accessibility and performance: axe on 16 routes, keyboard specs, query budgets.
- Security review: see docs/SECURITY-REVIEW.md.
- Docs: README, RUNBOOK, HANDOFF, `vercel.json` crons, `smoke:live`.
- The §6 Alex demo E2E.
- Home surface:
  - F15.1 family switcher **done**
  - F15.2 progress **done**
  - F15.3 schedule **done**
  - F15.5 pro shop **not built**

**Platform.**
- F17.1 jobs: 17 crons with a `job_runs` row per run **done**.
- F17.2 per-tenant feature flags **partial**: module entitlements act as flags; there's no separate flag system.
- F17.3 observability **partial**: there are `job_runs`, `ai_runs` and audit logs, but no error tracking.
- F17.4 backups **partial**: documented in the RUNBOOK; they rely on Supabase.
- Not built:
  - F1.10 custom domains
  - F2.8 platform-admin impersonation (the audit schema has the column; there's no UI or flow)
  - F2.9 2FA (not enforced in the app; HANDOFF to Supabase MFA)
- F2.4 staff invitations by email **done** (M5.02)

## The Alex demo (§6)
Generated by `tests/e2e/demo/alex-walkthrough.spec.ts` on a fresh demo reset. It is part of the gate. See
[docs/demo/WALKTHROUGH.md](../demo/WALKTHROUGH.md) for the page with every screenshot.

| # | Step | Status | Screenshot |
|---|---|---|---|
| 01 | Desk dashboard: live counts | PASS | [01](../demo/screenshots/01-dashboard.png) |
| 02 | People → "Cooper" → household with two kids | PASS | [02](../demo/screenshots/02-household.png) |
| 02b | Maya's profile | PASS | [02b](../demo/screenshots/02b-profile.png) |
| 03 | Tonight's Youth TKD session: booked + waitlisted | PASS | [03](../demo/screenshots/03-session.png) |
| 04 | Mat: 5 checked in, stripe + sign-off for Leo | PASS | [04](../demo/screenshots/04-mat.png) |
| 05 | Kiosk: Maya checks in with the family PIN | PASS | [05](../demo/screenshots/05-kiosk.png) |
| 05b | …present on the Mat roster | PASS | [05b](../demo/screenshots/05b-mat-kiosk.png) |
| 06 | Home: Leo's stripe + requirements | PASS | [06](../demo/screenshots/06-home-progress.png) |
| 06b | Home: card payment (4242…) | **HANDOFF** (Stripe keys) | [06b](../demo/screenshots/06b-home-billing.png) |
| 07 | Dunning step-2 invoice paid | **HANDOFF** for the card retry (a check payment is recorded instead) | [07](../demo/screenshots/07-dunning.png) |
| 08 | POS: Maya's size from her record, cash, stock −1 | PASS | [08](../demo/screenshots/08-pos.png) |
| 09 | Testing auto-roster: eligible + almost with gaps | PASS | [09](../demo/screenshots/09-testing-roster.png) |
| 09b | Home: Leo registers for the test | PASS | [09b](../demo/screenshots/09b-testing-home.png) |
| 09c | Leo registered and paid | **HANDOFF** for the card fee (cash at the desk instead) | [09c](../demo/screenshots/09c-testing-paid.png) |
| 10 | CRM: lead dragged to Trial scheduled (real booking) | PASS | [10](../demo/screenshots/10-crm-trial.png) |
| 10b | CRM: converted to member | PASS | [10b](../demo/screenshots/10b-crm-member.png) |
| 11 | Copilot: past-due and absent 3 weeks, with source (dev fixture) | PASS | [11](../demo/screenshots/11-copilot.png) |
| 11b | Drafted text approved → Outbox | **HANDOFF** (Twilio; the Outbox shows "no provider") | [11b](../demo/screenshots/11b-copilot-approved.png) |
| 12 | Drift: 7 at risk, Riley #1 with reasons | PASS | [12](../demo/screenshots/12-drift.png) |
| 12b | Riley's check-in approved | PASS | [12b](../demo/screenshots/12b-drift-approved.png) |
| 13 | Action board: 9 check-ins, 3 sign-offs, 1 injury (dev fixture) | PASS | [13](../demo/screenshots/13-board.png) |
| 13b | Board approved → attendance, sign-offs, injury note, task | PASS | [13b](../demo/screenshots/13b-board-approved.png) |
| 14 | Reports → Ask: attendance by program, 8 weeks, saved | PASS | [14](../demo/screenshots/14-nl-report.png) |
| 15 | Home: this week's approved updates | PASS | [15](../demo/screenshots/15-home-this-week.png) |
| 15b | Home: practice clip + released feedback (dev fixture) | PASS | [15b](../demo/screenshots/15b-technique.png) |
| 16 | Settings → Data export ZIP | PASS | [16](../demo/screenshots/16-export.png) |

Caveats:
- Every AI step (11, 12, 13, 14, 15, 15b) runs on dev fixtures. The step checks the real pipeline around the model, not the model itself: grounding, approvals, the writes that follow.
- The roster reads 14 eligible / 17 almost, per ADR-0029 rather than the spec's illustrative numbers.
- Step 05 (Kiosk) depends on the time of day: the kiosk offers classes near "now". The seed books tonight's class relative to the run time.

## Gate results
Verbatim summary printed by `npm run gate -- all` (run 2026-09-23T08:27:22Z, commit `7e3f6f8`, exit 0). The full
798-line output follows it, and is also at [gate-all-final.log](gate-all-final.log).

```
# Gate all — GREEN

Run: 2026-09-23T08:27:22.629Z · commit 7e3f6f8

| Step | Result | Time |
|---|---|---|
| typecheck | PASS | 5.8s |
| lint | PASS | 1.7s |
| unit | PASS | 1.2s |
| billing engine coverage (100% branches) | PASS | 0.4s |
| db | PASS | 57.4s |
| seed demo | PASS | 12.9s |
| seed invariants | PASS | 8.7s |
| AI transport is fixture for e2e | PASS | 0.4s |
| e2e (m0, m1, m2, m3, m4, m5) | PASS | 274.2s |
| §6 demo walkthrough (fresh demo reset) | PASS | 105.7s |
| production build: client bundle has no secrets | PASS | 9.7s |
| dependency audit (npm audit --omit=dev, high+) | PASS | 0.5s |

Blocked (excluded via @blocked tags): none

## HANDOFF (not verified live)
- specs tagged @stripe skipped: STRIPE_SECRET_KEY not set — these are NOT counted as passes
- specs tagged @ai-live skipped: OPENROUTER_API_KEY not set — these are NOT counted as passes
- specs tagged @email skipped: RESEND_API_KEY not set — these are NOT counted as passes

exit 0
```

Test counts from the run: unit 232 · billing coverage 76 · db 147 · seed invariants 15 · e2e 109 · walkthrough 1 ·
bundle scan 1 · npm audit 0 vulnerabilities (high+).

<details><summary>Full gate output (798 lines)</summary>

```

> gate
> tsx scripts/gate.ts all


━━ gate all › typecheck
$ npm run typecheck

> typecheck
> turbo run typecheck && tsc -p tsconfig.json

• turbo 2.9.18

   • Packages in scope: @koryo/ai, @koryo/billing, @koryo/comms, @koryo/config, @koryo/db, @koryo/eligibility, @koryo/payments, @koryo/scheduling, @koryo/ui, @koryo/web
   • Running typecheck in 10 packages
   • Remote caching disabled

@koryo/db:typecheck: cache hit, replaying logs 382b6b203472faa0
@koryo/db:typecheck: 
@koryo/db:typecheck: > @koryo/db@0.0.0 typecheck
@koryo/db:typecheck: > tsc --noEmit
@koryo/db:typecheck: 
@koryo/comms:typecheck: cache hit, replaying logs cf3e08c11e2019e5
@koryo/comms:typecheck: 
@koryo/comms:typecheck: > @koryo/comms@0.0.0 typecheck
@koryo/comms:typecheck: > tsc --noEmit
@koryo/comms:typecheck: 
@koryo/billing:typecheck: cache hit, replaying logs f2ec47d51809378d
@koryo/billing:typecheck: 
@koryo/billing:typecheck: > @koryo/billing@0.0.0 typecheck
@koryo/billing:typecheck: > tsc --noEmit
@koryo/billing:typecheck: 
@koryo/ui:typecheck: cache hit, replaying logs 0eeba75e9e7e8394
@koryo/ui:typecheck: 
@koryo/ui:typecheck: > @koryo/ui@0.0.0 typecheck
@koryo/ui:typecheck: > tsc --noEmit
@koryo/ui:typecheck: 
@koryo/eligibility:typecheck: cache hit, replaying logs 295aa51a2b7e13b5
@koryo/payments:typecheck: cache hit, replaying logs 9587bf20cf72b17e
@koryo/ai:typecheck: cache hit, replaying logs 4813c3b864278516
@koryo/payments:typecheck: 
@koryo/payments:typecheck: > @koryo/payments@0.0.0 typecheck
@koryo/payments:typecheck: > tsc --noEmit
@koryo/eligibility:typecheck: 
@koryo/eligibility:typecheck: > @koryo/eligibility@0.0.0 typecheck
@koryo/eligibility:typecheck: > tsc --noEmit
@koryo/payments:typecheck: 
@koryo/eligibility:typecheck: 
@koryo/ai:typecheck: 
@koryo/ai:typecheck: > @koryo/ai@0.0.0 typecheck
@koryo/ai:typecheck: > tsc --noEmit
@koryo/ai:typecheck: 
@koryo/scheduling:typecheck: cache hit, replaying logs db90eecbe8566dce
@koryo/scheduling:typecheck: 
@koryo/scheduling:typecheck: > @koryo/scheduling@0.0.0 typecheck
@koryo/scheduling:typecheck: > tsc --noEmit
@koryo/scheduling:typecheck: 
@koryo/web:typecheck: cache hit, replaying logs bf2d06d588a27988
@koryo/web:typecheck: 
@koryo/web:typecheck: > @koryo/web@0.1.0 typecheck
@koryo/web:typecheck: > next typegen && tsc --noEmit
@koryo/web:typecheck: 
@koryo/web:typecheck: Generating route types...
@koryo/web:typecheck: ✓ Types generated successfully

 Tasks:    9 successful, 9 total
Cached:    9 cached, 9 total
  Time:    68ms >>> FULL TURBO


━━ gate all › lint
$ npm run lint

> lint
> turbo run lint && eslint . --max-warnings 0

• turbo 2.9.18

   • Packages in scope: @koryo/ai, @koryo/billing, @koryo/comms, @koryo/config, @koryo/db, @koryo/eligibility, @koryo/payments, @koryo/scheduling, @koryo/ui, @koryo/web
   • Running lint in 10 packages
   • Remote caching disabled

@koryo/billing:lint: cache hit, replaying logs 3b4799ad911fa455
@koryo/eligibility:lint: cache hit, replaying logs 3594f01cd6434202
@koryo/db:lint: cache hit, replaying logs a581e177297f04bb
@koryo/db:lint: 
@koryo/eligibility:lint: 
@koryo/db:lint: > @koryo/db@0.0.0 lint
@koryo/eligibility:lint: > @koryo/eligibility@0.0.0 lint
@koryo/db:lint: > eslint . --max-warnings 0
@koryo/eligibility:lint: > eslint . --max-warnings 0
@koryo/db:lint: 
@koryo/eligibility:lint: 
@koryo/ai:lint: cache hit, replaying logs 86760b04327c6a16
@koryo/ai:lint: 
@koryo/ai:lint: > @koryo/ai@0.0.0 lint
@koryo/ai:lint: > eslint . --max-warnings 0
@koryo/ai:lint: 
@koryo/billing:lint: 
@koryo/billing:lint: > @koryo/billing@0.0.0 lint
@koryo/billing:lint: > eslint . --max-warnings 0
@koryo/billing:lint: 
@koryo/ui:lint: cache hit, replaying logs afa40142b8c64859
@koryo/ui:lint: 
@koryo/ui:lint: > @koryo/ui@0.0.0 lint
@koryo/ui:lint: > eslint . --max-warnings 0
@koryo/ui:lint: 
@koryo/ui:lint: Pages directory cannot be found at /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo/packages/ui/pages or /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo/packages/ui/src/pages. If using a custom path, please configure with the `no-html-link-for-pages` rule in your eslint config file.
@koryo/payments:lint: cache hit, replaying logs c92a3d4f90b845b6
@koryo/payments:lint: 
@koryo/payments:lint: > @koryo/payments@0.0.0 lint
@koryo/payments:lint: > eslint . --max-warnings 0
@koryo/payments:lint: 
@koryo/scheduling:lint: cache hit, replaying logs 8c24d46c26f68a8a
@koryo/scheduling:lint: 
@koryo/scheduling:lint: > @koryo/scheduling@0.0.0 lint
@koryo/scheduling:lint: > eslint . --max-warnings 0
@koryo/scheduling:lint: 
@koryo/comms:lint: cache hit, replaying logs c91797c671ee178e
@koryo/comms:lint: 
@koryo/comms:lint: > @koryo/comms@0.0.0 lint
@koryo/comms:lint: > eslint . --max-warnings 0
@koryo/comms:lint: 
@koryo/web:lint: cache hit, replaying logs f7747437ddce0c73
@koryo/web:lint: 
@koryo/web:lint: > @koryo/web@0.1.0 lint
@koryo/web:lint: > eslint . --max-warnings 0
@koryo/web:lint: 

 Tasks:    9 successful, 9 total
Cached:    9 cached, 9 total
  Time:    74ms >>> FULL TURBO


━━ gate all › unit
$ npx tsx scripts/stripe-mock.ts && npx vitest run --project unit
stripe-mock is listening on :12111

 RUN  v5.0.1 /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo

<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />

 Test Files  31 passed (31)
      Tests  232 passed (232)
   Start at  04:19:31
   Duration  660ms (transform 59%, tests 20%, import 20%, worker 2%)


━━ gate all › billing engine coverage (100% branches)
$ npm run test:billing

> test:billing
> vitest run --project unit packages/billing --coverage --coverage.include='packages/billing/src/**' --coverage.exclude='**/*.test.ts' --coverage.thresholds.branches=100 --coverage.thresholds.lines=100 --coverage.thresholds.functions=100


 RUN  v5.0.1 /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo
      Coverage enabled with v8


 Test Files  1 passed (1)
      Tests  76 passed (76)
   Start at  04:19:32
   Duration  151ms (transform 56%, tests 19%, import 15%, worker 10%)

[34m % [39m[2mCoverage report from [22m[33mv8[39m
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
----------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 100% ( 146/146 )
Branches     : 100% ( 101/101 )
Functions    : 100% ( 38/38 )
Lines        : 100% ( 116/116 )
================================================================================

━━ gate all › db
$ npx supabase db reset && npx tsx scripts/seed/index.ts --profile minimal && npx vitest run --project db
Resetting local database...
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 20260922000001_foundation.sql...
Applying migration 20260922000002_platform.sql...
Applying migration 20260922000003_identity.sql...
Applying migration 20260922000004_audit.sql...
Applying migration 20260922000005_auth_hook_and_tenant_rpc.sql...
Applying migration 20260922000006_people.sql...
Applying migration 20260922000007_notes.sql...
Applying migration 20260922000008_people_rpc.sql...
Applying migration 20260922000009_audit_rpc.sql...
Applying migration 20260922000010_household_rpc.sql...
Applying migration 20260922000011_curriculum.sql...
Applying migration 20260922000012_curriculum_defaults.sql...
Applying migration 20260922000013_schedule.sql...
Applying migration 20260922000014_comms.sql...
Applying migration 20260922000015_session_stats.sql...
Applying migration 20260922000016_roster_one_off_sessions.sql...
Applying migration 20260922000017_kiosk.sql...
Applying migration 20260922000018_bookings.sql...
Applying migration 20260922000019_outbox_queue.sql...
Applying migration 20260922000020_booking_fns_fix.sql...
Applying migration 20260922000021_threads.sql...
Applying migration 20260922000022_member_helpers.sql...
Applying migration 20260922000023_documents.sql...
Applying migration 20260922000024_kiosk_unsigned.sql...
Applying migration 20260922000025_reports_exports.sql...
Applying migration 20260922000026_export_tables.sql...
Applying migration 20260922000027_dashboard_wtd.sql...
Applying migration 20260923000028_billing.sql...
Applying migration 20260923000029_invoice_insert_status.sql...
Applying migration 20260923000030_stripe_ledger.sql...
Applying migration 20260923000031_enrollment_gear.sql...
Applying migration 20260923000032_billing_run_ar.sql...
Applying migration 20260923000033_tenant_local_dates.sql...
Applying migration 20260923000034_dunning.sql...
Applying migration 20260923000035_home_wallet.sql...
Applying migration 20260923000036_retail_inventory.sql...
Applying migration 20260923000037_pos.sql...
Applying migration 20260923000038_money_reports.sql...
Applying migration 20260923000039_mrr_definition.sql...
Applying migration 20260924000040_testing.sql...
Applying migration 20260924000041_crm.sql...
Applying migration 20260924000042_automations.sql...
Applying migration 20260924000043_automation_evaluate.sql...
Applying migration 20260924000044_events.sql...
Applying migration 20260924000045_afterschool.sql...
Applying migration 20260924000046_staff_ops.sql...
Applying migration 20260924000047_growth_reports.sql...
Applying migration 20260925000048_ai_core.sql...
Applying migration 20260925000049_approvals.sql...
Applying migration 20260925000050_knowledge_base.sql...
Applying migration 20260925000051_ai_conversations.sql...
Applying migration 20260925000052_drift.sql...
Applying migration 20260925000053_action_board.sql...
Applying migration 20260925000054_action_board_execute.sql...
Applying migration 20260925000055_doc_intake.sql...
Applying migration 20260925000056_nl_reports.sql...
Applying migration 20260925000057_growth_agents.sql...
Applying migration 20260925000058_technique_schedule.sql...
Applying migration 20260925000059_technique_consent_order.sql...
Applying migration 20260925000060_public_site.sql...
Applying migration 20260925000061_onboarding.sql...
Applying migration 20260925000062_imports.sql...
Applying migration 20260925000063_public_api.sql...
Applying migration 20260925000064_notifications.sql...
Applying migration 20260925000065_multi_location.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch claude/koryograph-build.
{"target":"local","version":"","message":"Reset local database."}
[seed] tenants: ridgeline, harbor
[seed] members: 7 per tenant
[seed] households: cooper, adams (ridgeline); quinn (harbor)
[seed] billing catalogue: 6 plans, 3 products with opening stock (ridgeline)
[seed] knowledge base: 4 chunks (ridgeline, fixture embeddings)
[seed] platform admin: platform@koryograph.demo (c540f6ed-2ebd-50a7-8114-22cbf69938fb)
[seed] profile minimal done in 1.8s

 RUN  v5.0.1 /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo

<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
{"level":40,"time":"2026-09-23T08:20:15.366Z","service":"koryograph-web","tenant_id":null,"user_id":null,"request_id":null,"webhook":"stripe","err":"No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe? \n If a webhook request is being forwarded by a third-party tool, ensure that the exact request body, including JSON formatting and new line style, is preserved.\n\nLearn more about webhook signing and explore webhook integration examples for various frameworks at https://docs.stripe.com/webhooks/signature\n","msg":"rejected stripe webhook"}
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />

 Test Files  37 passed (37)
      Tests  147 passed (147)
   Start at  04:20:03
   Duration  26.82s (tests 89%, import 8%, transform 2%)


━━ gate all › seed demo
$ npx tsx scripts/seed/index.ts --profile demo
[seed] tenants: ridgeline, harbor
[seed] members: 7 per tenant
[seed] households: cooper, adams (ridgeline); quinn (harbor)
[seed] billing catalogue: 6 plans, 3 products with opening stock (ridgeline)
[seed] knowledge base: 4 chunks (ridgeline, fixture embeddings)
[seed] platform admin: platform@koryograph.demo (c540f6ed-2ebd-50a7-8114-22cbf69938fb)
[seed] curriculum: 5 programs, 35 ranks
[seed] people: 221 students, 130 households, 156 guardians
[seed] schedule: 4503 sessions, 31927 check-ins, 740 promotions
[seed] documents, PINs, conversations, outbox, certifications
[seed] money: 220 memberships, 4152 invoices, 4300 payments (174 failed, 16 in dunning), 480 POS sales, 40 SKUs
[seed] grow: 9 leads, 4 events (34 registrations), after-school 18 kids / 672 days, 40 automation runs, 314 broadcast messages
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
[seed] kb_schedule_digest: {"tenants":1,"chunks":2,"not_embedded":0}
[seed] drift_score: {"tenants":1,"scored":197,"high":7,"drafted":7,"ai_drafts":7,"template_drafts":0}
[seed] lead_scoring: {"scored":8,"suggested":8,"suggestion_unavailable":0}
[seed] schedule_suggestions: {"tenants":1,"suggestions":5,"plain_wording":0}
[seed] parent_narratives: {"tenants":1,"drafted":124,"skipped_existing":0,"unavailable":0}
[seed] recording: 3 paper consents on file, uploaded as the instructor
[seed] transcribe: {"processed":1,"ready":1,"failed":0}
[seed] doc intake: packing slip read into a draft
[seed] technique_feedback: {"processed":2,"review":2,"failed":0}
[seed] technique: Maya's feedback released by the instructor, Leo's waiting for review
[seed] narratives: 2 approved and published to the Cooper family's Home
[seed] profile demo done in 12.4s

━━ gate all › seed invariants
$ npx vitest run --project seed

 RUN  v5.0.1 /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo

<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
[seed] kb_schedule_digest: {"tenants":1,"chunks":2,"not_embedded":0}
[seed] drift_score: {"tenants":1,"scored":197,"high":7,"drafted":0,"ai_drafts":0,"template_drafts":0}
[seed] lead_scoring: {"scored":0,"suggested":0,"suggestion_unavailable":0}
[seed] schedule_suggestions: {"tenants":1,"suggestions":5,"plain_wording":0}
[seed] parent_narratives: {"tenants":1,"drafted":0,"skipped_existing":124,"unavailable":0}

 Test Files  3 passed (3)
      Tests  15 passed (15)
   Start at  04:20:43
   Duration  8.43s (tests 95%, transform 3%, import 2%)


━━ gate all › AI transport is fixture for e2e
$ npx tsx scripts/check-ai-transport.ts
AI transport at http://localhost:3100: fixture

━━ gate all › e2e (m0, m1, m2, m3, m4, m5)
$ npx playwright test tests/e2e/m0 tests/e2e/m1 tests/e2e/m2 tests/e2e/m3 tests/e2e/m4 tests/e2e/m5 --grep-invert "@stripe|@ai-live|@email"

Running 109 tests using 2 workers

  ✓    2 [chromium] › tests/e2e/m0/a11y.spec.ts:6:3 › @m0 accessibility of the shells › public pages (2.8s)
  ✓    1 [chromium] › tests/e2e/m0/auth.spec.ts:18:3 › @m0 auth › password login lands each role on its surface (3.7s)
  ✓    4 [chromium] › tests/e2e/m0/auth.spec.ts:33:3 › @m0 auth › unauthenticated /desk redirects to /login?next=/desk (603ms)
  ✓    3 [chromium] › tests/e2e/m0/a11y.spec.ts:15:5 › @m0 accessibility of the shells › desk › dashboard and onboarding (2.3s)
  ✓    5 [chromium] › tests/e2e/m0/auth.spec.ts:38:3 › @m0 auth › an instructor gets a 403 page on /desk (1.2s)
  ✓    6 [chromium] › tests/e2e/m0/a11y.spec.ts:25:5 › @m0 accessibility of the shells › mat › today (905ms)
  ✓    7 [chromium] › tests/e2e/m0/auth.spec.ts:45:3 › @m0 auth › wrong password shows an error and stays on /login (861ms)
  ✓    8 [chromium] › tests/e2e/m0/a11y.spec.ts:33:5 › @m0 accessibility of the shells › home › home (890ms)
  ✓    9 [chromium] › tests/e2e/m0/auth.spec.ts:54:3 › @m0 auth › magic link signs in via the emailed link (1.5s)
  ✓   10 [chromium] › tests/e2e/m0/signup.spec.ts:19:3 › @m0 signup › a new owner creates a school and lands on onboarding with a 14-day trial (3.1s)
  ✓   11 [chromium] › tests/e2e/m0/auth.spec.ts:66:3 › @m0 auth › sign out returns to /login and protects /desk again (2.4s)
  ✓   13 [chromium] › tests/e2e/m0/ui.spec.ts:4:3 › @m0 /dev/ui renders every component in koryo-red without console errors (915ms)
  ✓   12 [chromium] › tests/e2e/m0/signup.spec.ts:54:3 › @m0 signup › an existing email is rejected with a clear message (2.3s)
  ✓   14 [chromium] › tests/e2e/m0/ui.spec.ts:4:3 › @m0 /dev/ui renders every component in light without console errors (972ms)
  ✓   16 [chromium] › tests/e2e/m1/bookings.spec.ts:36:3 › @m1 bookings › capacity 2: third is waitlisted; a timely cancel promotes them and earns a makeup credit (7.2s)
  ✓   17 [chromium] › tests/e2e/m1/comms.spec.ts:9:3 › @m1 communications › parent writes → staff sees unread → replies → parent sees the reply; email notice is in the Outbox (7.5s)
  ✓   18 [chromium] › tests/e2e/m1/comms.spec.ts:47:3 › @m1 communications › webhooks answer 503 until their provider is configured (120ms)
  ✓   19 [chromium] › tests/e2e/m1/comms.spec.ts:54:5 › @m1 communications › templates › a customised template previews with sample data and rejects unknown merge fields (2.0s)
  ✓   20 [chromium] › tests/e2e/m1/desk-people.spec.ts:14:5 › @m1 desk people › as owner › create a household with a guardian and two students, then find it (4.3s)
  ✓   21 [chromium] › tests/e2e/m1/desk-people.spec.ts:57:5 › @m1 desk people › as owner › CSV export contains exactly the filtered rows (864ms)
  ✓   22 [chromium] › tests/e2e/m1/desk-people.spec.ts:69:5 › @m1 desk people › as owner › bulk tag the selection (1.6s)
  ✓   15 [chromium] › tests/e2e/m1/a11y.spec.ts:12:5 › @m1 accessibility (zero serious/critical) › desk › dashboard, people, profile, household, schedule, programs, inbox, documents, reports (25.6s)
  ✓   23 [chromium] › tests/e2e/m1/desk-people.spec.ts:83:5 › @m1 desk people › as front desk › medical notes are hidden without people.medical.read (1.7s)
  ✓   24 [chromium] › tests/e2e/m1/a11y.spec.ts:26:5 › @m1 accessibility (zero serious/critical) › mat › today, a class roster, students (3.5s)
  ✓   26 [chromium] › tests/e2e/m1/a11y.spec.ts:39:5 › @m1 accessibility (zero serious/critical) › home › home, schedule, progress, messages, forms (5.7s)
  ✓   25 [chromium] › tests/e2e/m1/desk-programs.spec.ts:24:3 › @m1 desk programs › build a ladder: add ranks, reorder, set requirements with skills (10.6s)
  ✓   27 [chromium] › tests/e2e/m1/a11y.spec.ts:47:3 › @m1 accessibility (zero serious/critical) › kiosk (unpaired and paired) (2.4s)
  ✓   28 [chromium] › tests/e2e/m1/desk-programs.spec.ts:68:3 › @m1 desk programs › a brand-new school starts with the standard Taekwondo ladder (2.9s)
  ✓   29 [chromium] › tests/e2e/m1/desk-progress.spec.ts:33:3 › @m1 desk progress › enroll, sign off, award a stripe, promote, and see the history (5.0s)
  ✓   30 [chromium] › tests/e2e/m1/desk-schedule.spec.ts:30:3 › @m1 desk schedule › create a class → sessions in the week view → cancel one → roster families get a queued message (4.7s)
  ✓   32 [chromium] › tests/e2e/m1/desk-schedule.spec.ts:73:3 › @m1 desk schedule › the jobs endpoint rejects requests without the cron secret (883ms)
  ✓   33 [chromium] › tests/e2e/m1/kiosk.spec.ts:62:3 › @m1 kiosk › pair, search 'ma', PIN, check in → appears on the Mat roster (3.0s)
  ✓   34 [chromium] › tests/e2e/m1/kiosk.spec.ts:100:3 › @m1 kiosk › five wrong PINs lock the family out (3.0s)
  ✓   31 [chromium] › tests/e2e/m1/documents.spec.ts:26:3 › @m1 documents & waivers › publish → parent signs on Home (PDF stored) → v2 prompts again → signing link completes it (17.8s)
  ✓   35 [chromium] › tests/e2e/m1/mat-attendance.spec.ts:39:3 › @m1 mat attendance › check in on the Mat, award a stripe that shows on Home, and sync offline check-ins (9.1s)
  ✓   37 [chromium] › tests/e2e/m2/billing.spec.ts:34:3 › @m2 billing run & AR › billing_run invoices due memberships; cash payment → paid; partial refund → partially_refunded with a credit note (11.5s)
  ✓   36 [chromium] › tests/e2e/m1/reports.spec.ts:11:3 › @m1 dashboard, reports, export › dashboard shows live counts; attendance report renders chart and tables; export produces a ZIP (17.3s)
  ✓   38 [chromium] › tests/e2e/m2/billing.spec.ts:73:3 › @m2 billing run & AR › add a line, then email a receipt (Outbox without a provider) (7.8s)
  ✓   39 [chromium] › tests/e2e/m2/dunning.spec.ts:54:3 › @m2 dunning › day 1/3/7 notices → suspension at the final step → paying clears it (7.4s)
  ✓   40 [chromium] › tests/e2e/m2/enroll.spec.ts:48:3 › @m2 enrollment › second child gets the family discount on the preview and the invoice; cash marks it paid; kits reach fulfilment (8.8s)
  ✓   41 [chromium] › tests/e2e/m2/home-billing.spec.ts:46:3 › @m2 Home billing › parent sees balance, invoices, membership and receipts; requests a hold that staff apply (5.7s)
  ✓   43 [chromium] › tests/e2e/m2/payments.spec.ts:12:3 › @m2 payments without Stripe keys › owner sees that Stripe isn't configured and what to set (1.2s)
  ✓   44 [chromium] › tests/e2e/m2/payments.spec.ts:23:3 › @m2 payments without Stripe keys › household page offers no card entry and explains why (1.5s)
  ✓   45 [chromium] › tests/e2e/m2/payments.spec.ts:33:3 › @m2 payments without Stripe keys › a parent sees that online card payments aren't available yet (1.3s)
  ✓   46 [chromium] › tests/e2e/m2/payments.spec.ts:41:3 › @m2 payments without Stripe keys › a school without the Billing module is told so (581ms)
  ✓   47 [chromium] › tests/e2e/m2/plans.spec.ts:17:3 › @m2 membership plans admin › create a contract plan with family discount and kit, edit it, archive it (3.2s)
  ✓   42 [chromium] › tests/e2e/m2/money-reports.spec.ts:16:3 › @m2 money reports › each money report renders accessibly and exports CSV (10.6s)
  ✓   48 [chromium] › tests/e2e/m2/plans.spec.ts:52:3 › @m2 membership plans admin › validation: a contract needs a length; recurring needs an interval (1.1s)
  ✓   49 [chromium] › tests/e2e/m2/money-reports.spec.ts:29:3 › @m2 money reports › accounting export downloads sales lines by GL account and payments (1.4s)
  ✓   51 [chromium] › tests/e2e/m2/money-reports.spec.ts:39:3 › @m2 money reports › a core-only school has no money reports (718ms)
  ✓   50 [chromium] › tests/e2e/m2/plans.spec.ts:63:3 › @m2 membership plans admin › enroll wizard and fulfilment pages are accessible (2.5s)
  ✓   52 [chromium] › tests/e2e/m2/pos.spec.ts:23:3 › @m2 point of sale › sell 2 items for cash → stock down → receipt → return one → stock back, refund recorded → drawer variance (6.4s)
  ✓   53 [chromium] › tests/e2e/m2/retail-admin.spec.ts:17:3 › @m2 retail admin › create a product with 3 sizes, adjust stock, low stock shows below the reorder point (8.0s)
  ✓   55 [chromium] › tests/e2e/m2/retail-admin.spec.ts:67:3 › @m2 retail admin › suppliers list shows contact details (1.1s)
  ✓   54 [chromium] › tests/e2e/m3/afterschool.spec.ts:33:3 › @m3 after-school › manifest per route and day, absence queues an alert, weekly invoice from the billing run (10.4s)
  ✓   56 [chromium] › tests/e2e/m3/automations.spec.ts:32:3 › @m3 automations & broadcasts › enabling 'Absent 14 days' and running the evaluator queues messages for exactly the absent students (7.0s)
  ✓   58 [chromium] › tests/e2e/m3/automations.spec.ts:77:3 › @m3 automations & broadcasts › broadcast to 'Youth Taekwondo, active' creates exactly the previewed number of messages; no-consent excluded (3.9s)
  ✓   57 [chromium] › tests/e2e/m3/crm.spec.ts:42:3 › @m3 CRM pipeline & trials › public form → New → drag to Trial scheduled (booked) → attend on the Mat → Trial attended → convert → member; duplicate email merges (12.7s)
  ✓   60 [chromium] › tests/e2e/m3/growth-reports.spec.ts:15:3 › @m3 growth reports › each growth report renders from live data, passes axe and exports its CSV (10.4s)
  ✓   59 [chromium] › tests/e2e/m3/events.spec.ts:38:3 › @m3 events › camp: create with 3 days → parent signs the waiver, registers 2 days → paid → capacity enforced → check-in/out with signature (19.1s)
  ✓   62 [chromium] › tests/e2e/m3/events.spec.ts:137:3 › @m3 events › party: deposit invoice, and the guest waiver link signs without logging in (6.0s)
  ✓   61 [chromium] › tests/e2e/m3/staff.spec.ts:32:3 › @m3 staff ops › expired cert shows in compliance; kiosk clock in/out; sessions taught last month; payroll CSV matches the view; tasks (12.0s)
  ✓   64 [chromium] › tests/e2e/m4/action-board.spec.ts:43:3 › @m4 action board › upload the class audio → transcribed → board → approve all: 9 check-ins, 3 sign-offs, 1 task; the unsure row needs a tick (5.1s)
  ✓   65 [chromium] › tests/e2e/m4/action-board.spec.ts:76:3 › @m4 action board › a minor on the roster without AI-processing consent turns recording off (manual mode stays) (1.6s)
  ✓   66 [chromium] › tests/e2e/m4/ai-settings.spec.ts:23:3 › @m4 AI settings › key status, test connection through the gateway (logged), budget (3.3s)
  ✓   63 [chromium] › tests/e2e/m3/testing.spec.ts:29:3 › @m3 belt testing › create → auto-roster → invite → parent registers → fee paid → judge scores → bulk promote → certificate, Kukkiwon CSV (22.4s)
  ✓   68 [chromium] › tests/e2e/m4/copilot.spec.ts:19:3 › @m4 copilot & home assistant › ⌘K ask → 'How many students are past due?' answers with the AR view's numbers and cites the report (3.5s)
  ✓   67 [chromium] › tests/e2e/m4/approvals.spec.ts:30:3 › @m4 approvals › approve an edited draft → message queued; reject with feedback → stored (10.8s)
  ✓   69 [chromium] › tests/e2e/m4/copilot.spec.ts:56:3 › @m4 copilot & home assistant › Home assistant answers from policy and refuses another family, offering the front desk (3.3s)
  ✓   70 [chromium] › tests/e2e/m4/curriculum.spec.ts:16:3 › @m4 curriculum builder › Desk: prompt → 2 draft plans from the library (bogus skill dropped) → save, week 1 on a class → Mat shows it (5.1s)
  ✓   71 [chromium] › tests/e2e/m4/drift.spec.ts:23:3 › @m4 drift detector › nightly job → dashboard 'At risk' → ranked list with reasons → approve the drafted outreach → queued (3.8s)
  ✓   73 [chromium] › tests/e2e/m4/intake.spec.ts:31:3 › @m4 document intake › upload a packing slip → lines read and matched (fuzzy 'Focus mitts pair'; unknown board unmatched) → receive → stock up by the extracted quantities (1.9s)
  ✓   72 [chromium] › tests/e2e/m4/growth-agents.spec.ts:35:3 › @m4 growth agents › weekly narrative: drafted for a student who trained → edited and approved → shown to the family on Home (5.7s)
  ✓   74 [chromium] › tests/e2e/m4/knowledge.spec.ts:18:3 › @m4 knowledge base › add a document → indexed → the test search finds it; the nightly schedule digest is generated (3.3s)
  ✓   76 [chromium] › tests/e2e/m4/knowledge.spec.ts:42:3 › @m4 knowledge base › families can't open the knowledge base settings (824ms)
  ✓   75 [chromium] › tests/e2e/m4/growth-agents.spec.ts:80:3 › @m4 growth agents › lead scoring: a new lead gets a transparent score and a suggested next step on the board (2.8s)
  ✓   78 [chromium] › tests/e2e/m4/growth-agents.spec.ts:112:3 › @m4 growth agents › billing recovery mode is a per-school setting (off by default) (2.2s)
  ✓   77 [chromium] › tests/e2e/m4/nl-report.spec.ts:17:3 › @m4 natural-language reports › 'attendance by program last 8 weeks' → validated query → line chart + table → save → re-runs (3.6s)
  ✓   80 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: / (1.7s)
  ✓   81 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /pricing (1.5s)
  ✓   82 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /login (1.5s)
  ✓   83 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk (owner) (2.7s)
  ✓   84 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/people (owner) (2.3s)
  ✓   79 [chromium] › tests/e2e/m4/vision.spec.ts:46:3 › @m4 technique feedback & schedule suggestions › submit a clip → instructor reviews and edits → release → the family sees the score and 3 tips (10.4s)
  ✓   85 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/schedule (owner) (2.1s)
  ✓   86 [chromium] › tests/e2e/m4/vision.spec.ts:117:3 › @m4 technique feedback & schedule suggestions › weekly schedule suggestions appear on the Desk dashboard (2.7s)
  ✓   87 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/billing (owner) (1.8s)
  ✓   89 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/crm (owner) (2.0s)
  ✓   88 [chromium] › tests/e2e/m5/api.spec.ts:37:3 › @m5 public API and webhooks › key → GET people returns only that school's people (paged); another school's key sees none of them; webhook delivered signed (2.6s)
  ✓   90 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/reports (owner) (1.6s)
  ✓   92 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/inbox/approvals (owner) (4.8s)
  ✓   93 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /desk/settings/api (owner) (1.9s)
  ✓   94 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /mat (instructor) (3.2s)
  ✓   95 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /mat/reviews (instructor) (2.8s)
  ✓   91 [chromium] › tests/e2e/m5/import.spec.ts:26:3 › @m5 imports › 200-row Spark export → 200 students, households by guardian email, ranks set; re-import is idempotent; rollback; AI mapping for an unknown layout (15.2s)
  ✓   96 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /home (parent) (1.6s)
  ✓   98 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /home/progress (parent) (1.9s)
  ✓   99 [chromium] › tests/e2e/m5/a11y.spec.ts:28:5 › @m5 accessibility › axe: /home/billing (parent) (2.3s)
  ✓   97 [chromium] › tests/e2e/m5/multi-location.spec.ts:22:3 › @m5 multi-location › add a second location → switcher + dashboard rollup; staff limited to one location (5.8s)
  ✓  100 [chromium] › tests/e2e/m5/a11y.spec.ts:42:5 › @m5 accessibility › keyboard › Desk: skip link, then the nav is reachable and usable by Tab + Enter (2.0s)
  ✓  102 [chromium] › tests/e2e/m5/a11y.spec.ts:61:5 › @m5 accessibility › keyboard › dialog: opens from the keyboard, traps focus, Escape closes and focus returns (1.6s)
  ✓  103 [chromium] › tests/e2e/m5/a11y.spec.ts:77:5 › @m5 accessibility › keyboard › POS: scan field focused on load; type + Enter adds the item; the cart is operable by keyboard (2.5s)
  ✓  104 [chromium] › tests/e2e/m5/public.spec.ts:14:3 › @m5 public site › crawler: every internal link on the public site resolves (no 404s) (4.5s)
  ✓  105 [chromium] › tests/e2e/m5/public.spec.ts:43:3 › @m5 public site › pricing: plan prices and the module picker total match the plans/modules tables (2.1s)
  ✓  106 [chromium] › tests/e2e/m5/public.spec.ts:70:3 › @m5 public site › contact form lands in the platform inbox (1.8s)
  ✓  107 [chromium] › tests/e2e/m5/public.spec.ts:85:3 › @m5 public site › landing and legal pages are accessible and honest about drafts (2.1s)
  ✓  108 [chromium] › tests/e2e/m5/pwa.spec.ts:18:3 › @m5 Home PWA and notifications › Home is installable: manifest, icons, a controlling service worker and an offline shell (1.7s)
  ✓  101 [chromium] › tests/e2e/m5/onboarding.spec.ts:8:3 › @m5 onboarding wizard › a fresh school completes every step in one run and goes live on the plan picked on the site (19.1s)
  ✓  109 [chromium] › tests/e2e/m5/pwa.spec.ts:41:3 › @m5 Home PWA and notifications › a queued in-app message appears in Notifications, with an unread badge that clears (5.6s)

  109 passed (4.6m)

━━ gate all › §6 demo walkthrough (fresh demo reset)
$ npx supabase db reset && npx tsx scripts/seed/index.ts --profile demo && npx playwright test tests/e2e/demo --workers=1
Resetting local database...
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 20260922000001_foundation.sql...
Applying migration 20260922000002_platform.sql...
Applying migration 20260922000003_identity.sql...
Applying migration 20260922000004_audit.sql...
Applying migration 20260922000005_auth_hook_and_tenant_rpc.sql...
Applying migration 20260922000006_people.sql...
Applying migration 20260922000007_notes.sql...
Applying migration 20260922000008_people_rpc.sql...
Applying migration 20260922000009_audit_rpc.sql...
Applying migration 20260922000010_household_rpc.sql...
Applying migration 20260922000011_curriculum.sql...
Applying migration 20260922000012_curriculum_defaults.sql...
Applying migration 20260922000013_schedule.sql...
Applying migration 20260922000014_comms.sql...
Applying migration 20260922000015_session_stats.sql...
Applying migration 20260922000016_roster_one_off_sessions.sql...
Applying migration 20260922000017_kiosk.sql...
Applying migration 20260922000018_bookings.sql...
Applying migration 20260922000019_outbox_queue.sql...
Applying migration 20260922000020_booking_fns_fix.sql...
Applying migration 20260922000021_threads.sql...
Applying migration 20260922000022_member_helpers.sql...
Applying migration 20260922000023_documents.sql...
Applying migration 20260922000024_kiosk_unsigned.sql...
Applying migration 20260922000025_reports_exports.sql...
Applying migration 20260922000026_export_tables.sql...
Applying migration 20260922000027_dashboard_wtd.sql...
Applying migration 20260923000028_billing.sql...
Applying migration 20260923000029_invoice_insert_status.sql...
Applying migration 20260923000030_stripe_ledger.sql...
Applying migration 20260923000031_enrollment_gear.sql...
Applying migration 20260923000032_billing_run_ar.sql...
Applying migration 20260923000033_tenant_local_dates.sql...
Applying migration 20260923000034_dunning.sql...
Applying migration 20260923000035_home_wallet.sql...
Applying migration 20260923000036_retail_inventory.sql...
Applying migration 20260923000037_pos.sql...
Applying migration 20260923000038_money_reports.sql...
Applying migration 20260923000039_mrr_definition.sql...
Applying migration 20260924000040_testing.sql...
Applying migration 20260924000041_crm.sql...
Applying migration 20260924000042_automations.sql...
Applying migration 20260924000043_automation_evaluate.sql...
Applying migration 20260924000044_events.sql...
Applying migration 20260924000045_afterschool.sql...
Applying migration 20260924000046_staff_ops.sql...
Applying migration 20260924000047_growth_reports.sql...
Applying migration 20260925000048_ai_core.sql...
Applying migration 20260925000049_approvals.sql...
Applying migration 20260925000050_knowledge_base.sql...
Applying migration 20260925000051_ai_conversations.sql...
Applying migration 20260925000052_drift.sql...
Applying migration 20260925000053_action_board.sql...
Applying migration 20260925000054_action_board_execute.sql...
Applying migration 20260925000055_doc_intake.sql...
Applying migration 20260925000056_nl_reports.sql...
Applying migration 20260925000057_growth_agents.sql...
Applying migration 20260925000058_technique_schedule.sql...
Applying migration 20260925000059_technique_consent_order.sql...
Applying migration 20260925000060_public_site.sql...
Applying migration 20260925000061_onboarding.sql...
Applying migration 20260925000062_imports.sql...
Applying migration 20260925000063_public_api.sql...
Applying migration 20260925000064_notifications.sql...
Applying migration 20260925000065_multi_location.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch claude/koryograph-build.
{"target":"local","version":"","message":"Reset local database."}
[seed] tenants: ridgeline, harbor
[seed] members: 7 per tenant
[seed] households: cooper, adams (ridgeline); quinn (harbor)
[seed] billing catalogue: 6 plans, 3 products with opening stock (ridgeline)
[seed] knowledge base: 4 chunks (ridgeline, fixture embeddings)
[seed] platform admin: platform@koryograph.demo (c540f6ed-2ebd-50a7-8114-22cbf69938fb)
[seed] curriculum: 5 programs, 35 ranks
[seed] people: 221 students, 130 households, 156 guardians
[seed] schedule: 4503 sessions, 31927 check-ins, 740 promotions
[seed] documents, PINs, conversations, outbox, certifications
[seed] money: 220 memberships, 4152 invoices, 4300 payments (174 failed, 16 in dunning), 480 POS sales, 40 SKUs
[seed] grow: 9 leads, 4 events (34 registrations), after-school 18 kids / 672 days, 40 automation runs, 314 broadcast messages
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
[seed] kb_schedule_digest: {"tenants":1,"chunks":2,"not_embedded":0}
[seed] drift_score: {"tenants":1,"scored":197,"high":7,"drafted":7,"ai_drafts":7,"template_drafts":0}
[seed] lead_scoring: {"scored":8,"suggested":8,"suggestion_unavailable":0}
[seed] schedule_suggestions: {"tenants":1,"suggestions":5,"plain_wording":0}
[seed] parent_narratives: {"tenants":1,"drafted":124,"skipped_existing":0,"unavailable":0}
[seed] recording: 3 paper consents on file, uploaded as the instructor
[seed] transcribe: {"processed":1,"ready":1,"failed":0}
[seed] doc intake: packing slip read into a draft
[seed] technique_feedback: {"processed":2,"review":2,"failed":0}
[seed] technique: Maya's feedback released by the instructor, Leo's waiting for review
[seed] narratives: 2 approved and published to the Cooper family's Home
[seed] profile demo done in 14.4s

Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/demo/alex-walkthrough.spec.ts:51:3 › @demo Alex walkthrough (§6) › all fifteen steps and the close, on the demo seed (54.4s)

  1 passed (1.0m)

━━ gate all › production build: client bundle has no secrets
$ npm run build -w @koryo/web && npx vitest run --project bundle

> @koryo/web@0.1.0 build
> node scripts/next.mjs build

▲ Next.js 16.3.5 (Turbopack)
✓ Running next.config.ts took 22ms
- Experiments (use with caution):
  ✓ authInterrupts
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 1262ms
  Running TypeScript ...
  Finished TypeScript in 6.2s ...
  Collecting page data using 19 workers ...
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
  Generating static pages using 19 workers (0/118) ...
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
  Generating static pages using 19 workers (29/118) 
  Generating static pages using 19 workers (58/118) 
  Generating static pages using 19 workers (88/118) 
✓ Generating static pages using 19 workers (118/118) in 280ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /api/health
├ ƒ /api/jobs/[name]
├ ƒ /api/stripe/webhook
├ ƒ /api/v1/[resource]
├ ƒ /api/v1/openapi.json
├ ƒ /api/webhooks/resend
├ ƒ /api/webhooks/twilio
├ ƒ /auth/accept
├ ƒ /auth/callback
├ ƒ /auth/confirm
├ ƒ /auth/landing
├ ƒ /auth/signout
├ ƒ /contact
├ ƒ /desk
├ ƒ /desk/afterschool
├ ƒ /desk/afterschool/[id]
├ ƒ /desk/afterschool/[id]/manifest
├ ƒ /desk/automations
├ ƒ /desk/automations/[id]
├ ƒ /desk/billing
├ ƒ /desk/billing/failed
├ ƒ /desk/billing/invoices
├ ƒ /desk/billing/invoices/[id]
├ ƒ /desk/billing/plans
├ ƒ /desk/broadcasts
├ ƒ /desk/broadcasts/[id]
├ ƒ /desk/compliance
├ ƒ /desk/copilot
├ ƒ /desk/copilot/stream
├ ƒ /desk/crm
├ ƒ /desk/crm/leads/[id]
├ ƒ /desk/crm/stages
├ ƒ /desk/curriculum
├ ƒ /desk/curriculum/build
├ ƒ /desk/curriculum/lesson-plans
├ ƒ /desk/curriculum/lesson-plans/[id]
├ ƒ /desk/curriculum/lesson-plans/new
├ ƒ /desk/documents
├ ƒ /desk/documents/[id]
├ ƒ /desk/documents/new
├ ƒ /desk/events
├ ƒ /desk/events/[id]
├ ƒ /desk/events/[id]/checkin
├ ƒ /desk/events/new
├ ƒ /desk/households/[id]
├ ƒ /desk/inbox
├ ƒ /desk/inbox/[id]
├ ƒ /desk/inbox/approvals
├ ƒ /desk/onboarding
├ ƒ /desk/onboarding/[step]
├ ƒ /desk/outbox
├ ƒ /desk/people
├ ƒ /desk/people/[id]
├ ƒ /desk/people/[id]/enroll
├ ƒ /desk/people/export
├ ƒ /desk/people/import
├ ƒ /desk/people/import/[id]
├ ƒ /desk/people/new
├ ƒ /desk/pos
├ ƒ /desk/pos/sales/[id]
├ ƒ /desk/programs
├ ƒ /desk/programs/[id]
├ ƒ /desk/reports
├ ƒ /desk/reports/accounting
├ ƒ /desk/reports/ar-aging
├ ƒ /desk/reports/ask
├ ƒ /desk/reports/attendance
├ ƒ /desk/reports/attendance/export
├ ƒ /desk/reports/churn
├ ƒ /desk/reports/deferred
├ ƒ /desk/reports/eligibility
├ ƒ /desk/reports/events
├ ƒ /desk/reports/funnel
├ ƒ /desk/reports/growth/export
├ ƒ /desk/reports/money/export
├ ƒ /desk/reports/mrr
├ ƒ /desk/reports/payments
├ ƒ /desk/reports/retention
├ ƒ /desk/reports/revenue
├ ƒ /desk/reports/roster
├ ƒ /desk/reports/roster/export
├ ƒ /desk/reports/saved/[id]
├ ƒ /desk/reports/staff-sessions
├ ƒ /desk/retail
├ ƒ /desk/retail/fulfilment
├ ƒ /desk/retail/inventory
├ ƒ /desk/retail/inventory/movements
├ ƒ /desk/retail/products
├ ƒ /desk/retail/products/[id]
├ ƒ /desk/retail/receive
├ ƒ /desk/retail/suppliers
├ ƒ /desk/schedule
├ ƒ /desk/schedule/holidays
├ ƒ /desk/schedule/sessions/[id]
├ ƒ /desk/schedule/templates
├ ƒ /desk/settings
├ ƒ /desk/settings/ai
├ ƒ /desk/settings/api
├ ƒ /desk/settings/branding
├ ƒ /desk/settings/export
├ ƒ /desk/settings/kiosks
├ ƒ /desk/settings/knowledge
├ ƒ /desk/settings/location
├ ƒ /desk/settings/payments
├ ƒ /desk/settings/payments/refresh
├ ƒ /desk/settings/payments/return
├ ƒ /desk/settings/templates
├ ƒ /desk/staff
├ ƒ /desk/staff/[userId]
├ ƒ /desk/staff/payroll
├ ƒ /desk/staff/payroll/export
├ ƒ /desk/staff/shifts
├ ƒ /desk/tasks
├ ƒ /desk/testing
├ ƒ /desk/testing/[id]
├ ƒ /desk/testing/[id]/certificates
├ ƒ /desk/testing/[id]/export
├ ƒ /desk/testing/[id]/score
├ ƒ /desk/upgrade
├ ƒ /dev/ui
├ ƒ /features
├ ƒ /forgot-password
├ ƒ /home
├ ƒ /home/assistant
├ ƒ /home/billing
├ ƒ /home/billing/receipts/[id]
├ ƒ /home/documents
├ ƒ /home/documents/sign
├ ƒ /home/events
├ ƒ /home/events/[id]
├ ƒ /home/messages
├ ƒ /home/messages/[id]
├ ƒ /home/notifications
├ ƒ /home/progress
├ ƒ /home/progress/[skill]/submit
├ ƒ /home/schedule
├ ƒ /home/testing/[id]
├ ƒ /home/wallet
├ ƒ /kiosk
├ ƒ /login
├ ○ /manifest.webmanifest
├ ƒ /mat
├ ƒ /mat/reviews
├ ƒ /mat/schedule
├ ƒ /mat/session/[id]
├ ƒ /mat/session/[id]/board
├ ƒ /mat/session/[id]/plan
├ ƒ /mat/students
├ ƒ /mat/students/[id]
├ ƒ /mat/testing
├ ƒ /mat/testing/[id]
├ ○ /offline
├ ƒ /pricing
├ ƒ /privacy
├ ƒ /reset-password
├ ○ /robots.txt
├ ƒ /s/[slug]/trial
├ ƒ /sign/[token]
├ ƒ /sign/party/[token]
├ ƒ /signup
├ ○ /sitemap.xml
├ ƒ /terms
├ ƒ /welcome
└ ƒ /widget/[file]


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


 RUN  v5.0.1 /home/skwirls/Documents/VibeCoding/KoryoGraph-monorepo


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  04:27:21
   Duration  131ms (tests 47%, transform 32%, import 16%, worker 4%)


━━ gate all › dependency audit (npm audit --omit=dev, high+)
$ npm audit --omit=dev --audit-level=high
found 0 vulnerabilities

# Gate all — GREEN

Run: 2026-09-23T08:27:22.629Z · commit 7e3f6f8

| Step | Result | Time |
|---|---|---|
| typecheck | PASS | 5.8s |
| lint | PASS | 1.7s |
| unit | PASS | 1.2s |
| billing engine coverage (100% branches) | PASS | 0.4s |
| db | PASS | 57.4s |
| seed demo | PASS | 12.9s |
| seed invariants | PASS | 8.7s |
| AI transport is fixture for e2e | PASS | 0.4s |
| e2e (m0, m1, m2, m3, m4, m5) | PASS | 274.2s |
| §6 demo walkthrough (fresh demo reset) | PASS | 105.7s |
| production build: client bundle has no secrets | PASS | 9.7s |
| dependency audit (npm audit --omit=dev, high+) | PASS | 0.5s |

Blocked (excluded via @blocked tags): none

## HANDOFF (not verified live)
- specs tagged @stripe skipped: STRIPE_SECRET_KEY not set — these are NOT counted as passes
- specs tagged @ai-live skipped: OPENROUTER_API_KEY not set — these are NOT counted as passes
- specs tagged @email skipped: RESEND_API_KEY not set — these are NOT counted as passes

exit 0
```
</details>

## Blocked items
None. No task hit the BLOCKED protocol (§0.5).

## HANDOFF items
Everything here is real code that hasn't been run against the real service. For step-by-step setup, see
[docs/HANDOFF.md](../HANDOFF.md).

| Item | Status | Verify with |
|---|---|---|
| Stripe keys + CLI | no keys; CLI not installed | keys in `.env.local`, `stripe listen --forward-connect-to localhost:3100/api/stripe/webhook --forward-to localhost:3100/api/stripe/webhook`, `STRIPE_TEST_CONNECTED_ACCOUNT=acct_…`, then `npx playwright test --grep @stripe` |
| OpenRouter + model ids | no key; all AI output is labelled dev fixtures | `OPENROUTER_API_KEY`, `AI_MODEL_{FAST,FRONTIER,VISION,AUDIO,EMBED}`, then `npm run ai:eval` and `npx playwright test --grep @ai-live` |
| Resend / Twilio | no keys; messages wait in the Outbox as "no provider" | keys, then `npx playwright test --grep @email`; Desk → Outbox shows `sent` |
| Web push (VAPID) | no keys; notifications are in-app only | `npx web-push generate-vapid-keys`; Home → Notifications → Turn on push |
| Hosted Supabase settings | auth hook, URL config, rate limits (F3), MFA (F6), password length 8 | `npm run smoke:live` (checks the tenant claim) plus the dashboard |
| Hosted performance | measured locally only | `npx vitest run --project seed tests/seed/perf.test.ts` against a hosted copy of the demo seed |
| Vercel crons | 17 crons; several run every minute, which needs the Pro plan | `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/ai_models_sync` |
| Import presets | the Spark, Zen Planner and Kicksite column names are assumptions | import a real export; fix `apps/web/src/lib/import/fields.ts` |
| Live smoke test | not run (no deployment) | `SMOKE_BASE_URL=… npm run smoke:live` |

Deviation: §7's `billing_run` dry run isn't possible, because that job has no dry-run mode. The smoke test triggers
`ai_models_sync` instead.

## Known gaps vs §2
Ordered by impact on the Alex demo:
1. **Card payments were never exercised live** (06b, 07, 09c, autopay, POS Terminal). This is the largest risk in the demo; the stripe-mock tests and webhook fixture replays reduce it but don't remove it.
2. **The quality of the AI agents is unmeasured.** Drafts, the copilot, the action board and technique feedback have only ever run on hand-authored fixtures. Prompts and schemas are tested; the answers aren't.
3. **Real SMS and email delivery** (11b, the automations) haven't been verified.
4. **Platform subscription billing is not built.** "Go live" records the plan but charges nothing.
5. **2FA isn't enforced in the app, and there's no platform-admin impersonation.** Neither appears in the demo, but both matter for real schools.
6. **Security finding F4 is open:** outbound webhooks can be DNS-rebound to internal addresses. The mitigation is to resolve and pin IPs, or route through an egress proxy.
7. **There is no error tracking or log drain.**
8. **P1/P2 features not built:**
   - referrals (F3.7) and @mentions (F3.9)
   - Home pro shop (F15.5)
   - membership-contract e-sign (F12.4)
   - scheduled report delivery and KPI targets (F14.3)
   - custom report builder (F14.4)
   - instructor scorecards (F13.4)
   - landing page builder (F11.2)
   - custom domains (F1.10)
   - sales tax and surcharges (F7.11)
   - barcode label printing (F8.7)
   - belt-inventory reservation (F6.7)
   - QR/door check-in (F5.10)
   - choreography (F4.7)
   - private lessons are partial (F5.7)
9. **Import gaps:** attendance history is imported as a count only, and the vendor presets are unverified.
10. **The public legal pages (privacy, terms) are drafts** and say so; they need a lawyer.

## Recommended next 10 tasks
1. Add Stripe test keys and the CLI. Run the `@stripe` specs and replay the §6 card steps live, which turns 06b, 07 and 09c into PASS.
2. Add an OpenRouter key and pick the model tiers. Run `ai:eval` and `ai:record`, review real outputs for the Drift, Copilot, Action Board and technique agents, and tune the prompts.
3. Deploy to a hosted Supabase project and Vercel per HANDOFF.md, then run `npm run smoke:live`.
4. Fix F4: pin resolved IPs for outbound webhooks and add a test with a rebinding resolver.
5. Wire error tracking (Sentry or a log drain) and add alerts on `job_runs` errors.
6. Enforce MFA for owners and admins in the app (the Supabase AAL check) and build audited platform-admin impersonation (F2.8).
7. Build platform subscription billing: Stripe Billing on the platform account, charged at go-live.
8. Configure Resend and Twilio, then verify the Outbox → delivery-status webhooks → inbound SMS round trip.
9. Validate the import presets against real Spark, Zen Planner and Kicksite exports, and import attendance history.
10. Build the highest-value P1s: referrals, the Home pro shop, membership-contract e-sign, and scheduled report delivery.
