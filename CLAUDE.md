# KoryoGraph — agent guide

Spec and execution plan: `KORYOGRAPH-BUILD.md` (read §0 on every resume). Build position:
`docs/build/PROGRESS.md`. Deviations: `docs/build/DECISIONS.md` (append-only).

## Honesty rules (non-negotiable)
- Nothing is faked: no `MOCK_*` data, hardcoded KPIs, `setTimeout` "APIs", or fabricated users.
- Every screen reads/writes the real database via the user-scoped client (RLS). Never bypass auth.
- External services are real code paths; missing keys → the UI says so (Outbox, "no key").
- A failing gate is reported as failing. Never weaken a test to pass.
- Tenant isolation lives in the database (RLS + guard tests); minors' media needs recorded consent.

## Commands
```bash
npm install
npm run db:start          # local Supabase (Docker)
npm run db:reset          # migrations + minimal seed (add `-- --profile demo` for the demo school)
npm run db:types          # regenerate packages/db/src/types.gen.ts
npm run dev               # http://localhost:3100  (/desk /mat /home /kiosk)
npm run check             # typecheck + lint + unit (starts stripe-mock in Docker if needed)
npm run stripe:mock       # stripe-mock on :12111 for the payments unit tests
npm run test:db           # schema, guards, RLS matrix (needs local Supabase)
npm run test:e2e          # Playwright
npm run gate -- m0        # cumulative milestone gate (Appendix B); `all` for everything
npm run jobs:tick         # run due jobs locally
```

## Stripe (test mode)
- Keys go in the root `.env.local`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_PLATFORM_FEE_BPS`. Without them the app says Stripe isn't
  configured and offers no card entry. Schools connect a Standard account in Desk → Settings → Payments.
- Webhooks locally (Connect events come from connected accounts, so forward both):
  ```bash
  stripe listen --forward-connect-to localhost:3100/api/stripe/webhook --forward-to localhost:3100/api/stripe/webhook
  ```
  Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.
- `tests/e2e/m2/stripe.spec.ts` (@stripe) also needs `STRIPE_TEST_CONNECTED_ACCOUNT`: an already onboarded
  test-mode Standard account connected to your platform (hosted onboarding can't run headlessly).
- Unit tests use stripe-mock (`STRIPE_MOCK=1` semantics, host override to :12111); webhook handler tests
  replay fixture events from `tests/fixtures/stripe/`.

## Layout
- `apps/web` — the single Next.js app; route groups `(public) (desk) (mat) (home) (kiosk)`.
- `apps/web/src/server` — server-only code; service role only under `server/admin/**`, jobs, webhooks.
- `packages/{ui,db,billing,payments,eligibility,scheduling,ai,comms,config}`; `supabase/migrations` is the schema source of truth.
- `tests/db`, `tests/e2e`; unit tests sit next to code as `*.test.ts`.

## Conventions
- TypeScript strict, no `any`. zod at every boundary. Money = integer cents. Times = `timestamptz` UTC.
- Server actions start with `getCtx()` then `require*()`. Every mutation writes `audit_events`.
- Commits: `<type>(<task-id>): <summary>` (feat, fix, chore, test, docs, refactor, seed, migrate).
- CI: `.github/workflows/ci.yml` runs `npm run gate -- all` with `AI_TRANSPORT=fixture`.
