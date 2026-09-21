# KoryoGraph — Autonomous Build Instructions

**Purpose.** This document is the complete, self-contained specification and execution plan for building the
KoryoGraph prototype: an AI-native, modular studio-operations platform for martial arts schools that is a
credible, flat-out-better competitor to Spark Membership (and Zen Planner / Kicksite / Gymdesk). It is written
to be executed **start to finish by an autonomous coding agent** with no human in the loop, and to survive
context loss mid-run.

**Trigger.** Do nothing until the human says **"go"**. On "go", start at §0.2 and do not stop until the Stop
Conditions in §0.8 are met.

**Audience.** The executing agent first; John and Alex second. Sections are numbered so a resumed session can
jump straight to what it needs.

---

## Table of contents

- §0 Operating protocol (READ FIRST, and re-read on every resume)
- §1 As-built state: what exists, what to keep, what to delete
- §2 Product definition (the PRD): vision, personas, modules & packaging, feature spec, AI layer, NFRs
- §3 Technical architecture: stack, layout, auth & tenancy, RLS, data access, payments, AI gateway, comms, jobs, testing, design system
- §4 Data model (target schema)
- §5 Milestones M0–M5: the task list with acceptance criteria and gates
- §6 The Alex demo script (final acceptance E2E)
- §7 HANDOFF: what John must supply, and the live smoke tests
- Appendix A — Feature parity matrix
- Appendix B — Gate scripts and guard tests
- Appendix C — Seed data specification
- Appendix D — PROGRESS.md template, commit conventions, final report format

---

# §0 Operating protocol

## 0.1 Prime directive and the honesty rules

The repo you are starting from failed in a specific way: it **simulated** the product. A chatbot that
`setTimeout`s a canned reply claiming "Supabase data integrations are active"; a "Pay Dues Now" button with no
handler; a biomechanics panel whose own copy says "simulated"; a fabricated logged-in user when auth is
absent; a roadmap that marks unbuilt things ✅. It looked functional and was ~10% real. **You will not do this.**

Non-negotiable rules, checked by gates where possible and by you always:

1. **Nothing is faked.** No `MOCK_*` constants rendered as data. No hardcoded KPIs. No `setTimeout` posing as
   an API. No fabricated users. If a feature is not built, it is **absent** or shows an honest empty state —
   never a lookalike.
2. **Every screen reads and writes the real database** through the real data layer with real authorization.
3. **External services are real code paths, exercised against real test doubles** (stripe-mock, recorded AI
   fixtures, a comms outbox), never bypassed. When a provider isn't configured, the UI says so plainly
   ("AI provider not configured — add an OpenRouter key in Settings → Integrations"), and fixture responses are
   **visibly labeled** ("Fixture response — dev only") and refused in production builds.
4. **A gate that fails is reported as failed.** You never edit a test to pass, skip a test, loosen an
   assertion, or mark a task done that isn't. If you can't make it pass after the retry budget, you record it
   as BLOCKED with a diagnosis and move on (§0.5).
5. **Tenant isolation is enforced in the database.** Every tenant-scoped table has RLS with a policy, and a
   guard test fails the build if any table has RLS enabled with zero policies (the old schema's fatal defect).
6. **Minors' data is treated as sensitive by default.** No student video/audio leaves the tenant without an
   explicit, logged consent record; AI features on minors' media require guardian consent flags.

## 0.2 The loop

You execute **milestones** (M0…M5). Each milestone is a list of **tasks** (e.g. `M1.04`). Each task is small
enough to finish and commit in one sitting, and has an **acceptance** clause you can verify mechanically.

For every task, run this loop exactly:

```
LOOP(task):
  1. READ    docs/build/PROGRESS.md  → confirm this is the current task; note any deviations logged.
  2. PLAN    Re-read the task spec in §5 and the relevant §3/§4 sections. List files you'll touch.
  3. BUILD   Implement. Small, typed, tested. Follow §0.6 rules.
  4. VERIFY  Run the task's acceptance command(s). Then run `npm run check` (typecheck + lint + unit).
             If the task touched the DB: `npm run test:db`. If it touched UI routes: the named e2e spec.
  5. FIX     If anything fails: diagnose from the actual error output, fix, go to 4. Retry budget: 3 full
             attempts per task. Never "fix" by weakening the check.
  6. COMMIT  git add -A && git commit -m "<type>(<task-id>): <summary>" (conventions in Appendix D).
  7. RECORD  Update docs/build/PROGRESS.md: mark task done with commit SHA; set "Current task" to the next.
  8. NEXT    Continue to the next task. Do not ask for permission. Do not stop to summarize.
```

At the end of every milestone:

```
GATE(milestone):
  1. Run `npm run gate -- <milestone>` (Appendix B). It runs everything: typecheck, lint, unit, db, e2e for
     that milestone and all previous ones.
  2. If green: git tag <milestone>-complete && git push -u origin claude/pensive-mendel-rjoa9k --tags
     Record the gate result in PROGRESS.md. Proceed to the next milestone.
  3. If red: fix (retry budget 3). If still red, log BLOCKED items per §0.5, push anyway (work is not
     lost), and proceed — later milestones must not depend on a blocked task; if they do, mark them
     blocked too and skip to the next independent task.
```

**Push cadence:** at every milestone gate, and additionally at least every 10 task commits. Pushes go only to
`claude/pensive-mendel-rjoa9k`. Never open a PR unless asked.

## 0.3 Checkpoints and state files

You maintain three files under `docs/build/`, created in M0.02:

- `PROGRESS.md` — the single source of truth for where the build is. Template in Appendix D. Update it on
  every task completion, every gate, every block. **On any resume, read this first.**
- `DECISIONS.md` — an append-only ADR log. Any time you deviate from this document (a library doesn't work,
  an API changed, a spec is contradictory), append: date, task, what the doc said, what you did, why.
  Deviations are allowed; **undocumented** deviations are not.
- `FINAL-REPORT.md` — written once at the end (§0.8).

## 0.4 Resuming after context loss

Your context will be summarized mid-run. When you notice you are resuming (a summary precedes you, or you
have no memory of the last tool call), do this and only this:

1. `cat docs/build/PROGRESS.md` — find "Current task".
2. Re-read §0 of this document (this section) in full.
3. Read **only** the §5 entry for the current milestone, and skim §3/§4 sections it references.
4. `git status && git log --oneline -5` — see whether the current task has uncommitted work. If the tree is
   dirty, finish or revert that task deliberately; never leave half-work uncommitted for long.
5. Re-enter the LOOP at step 2 for the current task.

Do not re-read the whole document. Do not re-do the as-built audit. Do not re-litigate decisions in
`DECISIONS.md`.

## 0.5 When stuck: the BLOCKED protocol

After 3 genuine attempts on a task or gate:

1. Append to `PROGRESS.md` under "Blocked": task id, one-paragraph diagnosis (actual error text, what you
   tried), and what a human would need to do or decide.
2. If the blocker is a **missing external service or key** (Stripe live, OpenRouter, SMTP, DNS), it is not a
   defect — record it under "HANDOFF items" instead and keep the code path real and tested against its double.
3. Move to the next task that does not depend on the blocked one. Milestone gates treat blocked tasks as
   known-failing: the gate script excludes tests tagged with a blocked task id **only if** that id appears in
   `PROGRESS.md`'s Blocked table (Appendix B shows the mechanism). This is the one sanctioned way a red test
   coexists with progress, and it is visible in the final report.

Never: delete a failing test, `.skip` it silently, comment out an assertion, widen a type to `any` to get past
a compile error, or catch-and-ignore an exception to make a page render.

## 0.6 Rules of engagement (engineering)

- **TypeScript strict, no `any`** (use `unknown` + narrowing). ESLint errors block commits.
- **Pin every dependency** to the exact versions in §3.1. Do not upgrade mid-run. If a pinned version is
  broken, pick the nearest working version, pin it, and log in DECISIONS.md.
- **Before using any library API you are not certain of, read its `.d.ts` in `node_modules`** (Better Auth,
  Drizzle, pg-boss, Stripe, openai, rrule especially). Do not guess signatures.
- **Server-first.** Data mutations are Next.js server actions or route handlers, validated with zod, executed
  inside `withTenant()` (§3.4). Client components never hold the DB client. No secrets in client bundles.
- **One way to do each thing.** Forms: react-hook-form + zod. Tables: the shared `DataTable`. Dates:
  date-fns, stored UTC, displayed in tenant timezone. Money: integer cents, `currency` column, never floats.
  IDs: uuid v4 from the DB default.
- **Tests live next to code** (`*.test.ts`) for unit; `tests/db/*` for database/RLS; `tests/e2e/*` for
  Playwright. Every task's acceptance is a test or a command that exits non-zero on failure.
- **Seed is deterministic** (seeded PRNG). Running `npm run db:reset` twice yields identical data.
- **Accessibility is not optional**: semantic HTML, labels on every input, focus states, keyboard operable
  dialogs and menus, 4.5:1 contrast. The kiosk and parent surfaces are used by non-technical people.
- **Mobile-first for Mat and Home; desktop-first for Desk.** Every route renders correctly at 390px and 1280px.
- **Logging**: pino, structured, with `tenant_id` and `user_id` on every server log line. No `console.log`
  in committed code outside scripts.
- **Commit small and often.** One task = one commit minimum. Conventional commits (Appendix D).
- **Don't gold-plate.** Build the acceptance clause, make it correct, move on. Depth comes from later tasks.

## 0.7 Environment facts (this sandbox)

Verified on 2026-09-21. Re-verify quickly in M0.01; log differences in DECISIONS.md.

| Capability | Status | Consequence |
|---|---|---|
| Node 22.22 / npm 10.9 | ✅ | Use npm workspaces (already configured). |
| npm registry | ✅ reachable | All dependencies install normally. |
| Postgres 16 + pgvector via `apt-get install postgresql-16 postgresql-16-pgvector` | ✅ verified | **Primary DB for the whole build.** Runs as the `postgres` OS user with `pg_ctl`, no systemd. Commands in M0.01. |
| Docker daemon | ❌ not running | No local Supabase stack. Do not attempt. |
| supabase.com / api.stripe.com / openrouter.ai | ❌ unreachable | Live integrations cannot be exercised here → HANDOFF (§7). |
| stripe-mock (GitHub release tarball) | ✅ downloads and runs | Stripe SDK tests run against `http://localhost:12111`. |
| GitHub (git push, api.github.com) | ✅ | Pushing to origin works. |
| Playwright Chromium | ✅ at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | `@playwright/test@1.63` expects a different revision → **always set `launchOptions.executablePath`** to that path when it exists. Never run `playwright install`. |
| ffmpeg | ✅ under `/opt/pw-browsers/ffmpeg-1011/` (find the binary) | Keyframe extraction for video tasks. |
| ui.shadcn.com registry | ❌ blocked | **Hand-vendor components** from Radix primitives (§3.10). No `npx shadcn`. |
| fonts.gstatic.com | ❌ blocked | Self-host fonts via `@fontsource-variable/*`. Never `next/font/google`. |
| Disk | ~30 GB free | Fine. Clean `.next`/`node_modules` in `/tmp` scratch projects if low. |

Env vars: none of the product's keys are present. Everything runs with local defaults from `.env.example`.
`ANTHROPIC_BASE_URL` in the environment belongs to the harness — **never** use it from product code.

## 0.8 Stop conditions and the final report

Stop only when one of these is true:

1. **Done**: M5 gate is green (or green-with-recorded-blocks), the Alex demo E2E (§6) passes, and
   `docs/build/FINAL-REPORT.md` is written and pushed.
2. **Hard stop**: the environment is broken in a way you cannot repair (e.g. disk full after cleanup, git
   push impossible after 4 retries with backoff). Write FINAL-REPORT.md with what you have, commit locally,
   and stop.

FINAL-REPORT.md format (Appendix D) — what shipped per milestone, the demo click-path status, blocked items
with diagnoses, HANDOFF items, and a candid "known gaps vs. §2" list. **Candor is the deliverable.** A report
that overstates the build is a failure of the build.

