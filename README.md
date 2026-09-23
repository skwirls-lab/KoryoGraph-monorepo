# KoryoGraph

Software for martial arts schools: a **Desk** for the front office, a **Mat** for instructors on a tablet, a
**Home** app for families, and a **Kiosk** for check-in. It includes memberships and billing through Stripe
Connect, attendance and belt progress, events and after-school, retail and POS, and a lead pipeline. On top
of that sit AI agents that draft the work and leave the decisions to staff: copilot, drift detector, action
board, natural-language reports, parent updates and technique feedback.

This is a working prototype built against a written spec (`KORYOGRAPH-BUILD.md`). Everything reads and writes a
real Postgres database under row-level security. Services without keys (Stripe, OpenRouter, Resend, Twilio,
web push) degrade visibly — the app says "not configured" — and are never faked.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind 4 · Supabase (Postgres 17, Auth, Storage,
RLS) · Stripe Connect · OpenRouter (AI) · Playwright · Vitest · Turborepo. One app in `apps/web`, domain
packages in `packages/*`, schema in `supabase/migrations`.

## Run it locally
Needs Node 22, Docker, and ~4 GB RAM for local Supabase.
```bash
npm install
cp .env.example .env.local        # then fill the Supabase values from: npx supabase status -o env
npm run db:start                  # local Supabase in Docker
npm run db:reset -- --profile demo   # schema + the demo school "Ridgeline Taekwondo"
npm run dev                       # http://localhost:3100
```
Sign in as `owner@ridgelinetkd.demo` / `KoryoDemo!2026`. Other roles are in
[docs/build/DEMO-ACCOUNTS.md](docs/build/DEMO-ACCOUNTS.md). Scheduled jobs run with `npm run jobs:tick`.

## Test it
```bash
npm run check                     # typecheck + lint + unit tests
npm run test:db                   # schema guards, RLS matrix, RPCs (needs local Supabase)
npm run test:e2e                  # Playwright (needs `npm run dev`)
npm run gate -- all               # the cumulative milestone gate CI runs (resets the local DB)
```
The gate's result is the source of truth. Specs that need a real key (`@stripe`, `@ai-live`, `@email`) are
reported as HANDOFF, never as passes.

## Deploy it
Vercel (root `apps/web`, crons from `apps/web/vercel.json`) + a hosted Supabase project + Stripe, OpenRouter
and optionally Resend/Twilio. Step-by-step with every value: [docs/HANDOFF.md](docs/HANDOFF.md). Operating
it — jobs, webhooks, Stripe Connect, AI budgets, backups: [docs/RUNBOOK.md](docs/RUNBOOK.md). After deploying,
`npm run smoke:live` checks it against the real services.

## Where things are
- [KORYOGRAPH-BUILD.md](KORYOGRAPH-BUILD.md) — the spec · [docs/build/PROGRESS.md](docs/build/PROGRESS.md) — build log and gates · [docs/build/DECISIONS.md](docs/build/DECISIONS.md) — every deviation, with reasons
- [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md) — security checklist and open findings
- [CLAUDE.md](CLAUDE.md) — conventions for anyone (or any agent) changing the code
