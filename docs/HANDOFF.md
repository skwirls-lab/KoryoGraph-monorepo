# Handoff — deploying KoryoGraph and verifying it live

This is spec §7 with the concrete values from the build. The prototype passes its gates locally. Everything
below needs an account, key or network the build didn't have, so none of it has been verified live yet. Each
item says exactly how to verify it.

## 1. Accounts (≈ 30–45 minutes)

### Supabase (hosted)
1. Create a project, choosing the region nearest the schools. Copy the **Project URL**, the **anon key**, the
   **service_role key** and the **database connection string**.
2. From the repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push --include-seed   # all migrations + supabase/seed.sql
   ```
   `seed.sql` is reference data the app needs: the permission catalogue, modules and plans, and the scheduled
   jobs. It must be applied; `db push` alone skips it. For the demo school as well, run
   `SUPABASE_DB_URL=<connection string> npm run db:seed -- --profile demo` (it creates auth users through the
   service key).
3. **Auth → Hooks:** enable *Custom Access Token* → Postgres function `auth_hook.custom_access_token`. Without
   it, users have no school in their token and every screen is empty. `npm run smoke:live` checks this.
4. **Auth → URL configuration:** set Site URL to `https://koryograph.ai`. Add redirect URLs
   `https://koryograph.ai/**`, `https://*.koryograph.ai/**`, `https://desk.koryograph.ai/**`,
   `https://app.koryograph.ai/**` and `https://home.koryograph.ai/**`.
5. **Auth → Providers → Email:**
   - turn on "Confirm email";
   - minimum password length **8**;
   - SMTP: use Resend's SMTP or another provider. Supabase's built-in mailer is rate-limited, and invitations
     and password resets go through it.
6. **Auth → Rate limits:** tighten from the local test values, e.g. sign-in/sign-up 30 per 5 min per IP, and
   emails 30 per hour (security review F3).
7. **Auth → MFA:** enable TOTP and ask owners and admins to enrol (F6; the app doesn't enforce it yet).
8. Optional **Google sign-in:** Auth → Providers → Google, with `SUPABASE_AUTH_GOOGLE_CLIENT_ID` and `_SECRET`.
9. **Storage:** the `tenant-media` bucket and its policies are created by the migrations. Check that
   backups/PITR are on (see [RUNBOOK.md](RUNBOOK.md)).

### Stripe (test mode first)
1. Get the platform keys: `STRIPE_SECRET_KEY` (sk_test_…) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. **Connect:** enable Connect with **Standard** accounts and set the platform's branding.
3. **Webhook:** Developers → Webhooks → add endpoint `https://koryograph.ai/api/stripe/webhook`.
   - Listen to events on **your account and connected accounts**.
   - Events:
     - `account.updated`
     - `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, `payment_intent.canceled`
     - `setup_intent.succeeded`, `setup_intent.setup_failed`
     - `payment_method.attached`, `payment_method.updated`, `payment_method.detached`
     - `charge.refunded`
     - `customer.created`, `customer.updated`, `customer.deleted`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Local end-to-end:** install the Stripe CLI and run
   `stripe listen --forward-connect-to localhost:3100/api/stripe/webhook --forward-to localhost:3100/api/stripe/webhook`.
5. For the `@stripe` specs, set `STRIPE_TEST_CONNECTED_ACCOUNT` to an already-onboarded test Standard account
   (hosted onboarding can't run headlessly).
6. **POS:** create a Terminal *simulated* reader and register it in Desk → Settings → Payments.
7. **Fees:** `STRIPE_PLATFORM_FEE_BPS` is the application fee in basis points; 0 means none.
8. **Not built:** billing schools for their own KoryoGraph subscription. "Go live" records the plan but
   charges nothing. Stripe Billing for the platform is future work.

### OpenRouter (AI)
1. Create a key and set `OPENROUTER_API_KEY`. Set a spending limit on the OpenRouter side as well; each
   school's own monthly budget is set in Desk → Settings → AI.
2. Choose a model per tier; there are no defaults. Use ids from openrouter.ai/models:
   - `AI_MODEL_FAST`: cheap text, used for drafts and suggestions;
   - `AI_MODEL_FRONTIER`: copilot, action board, reports;
   - `AI_MODEL_VISION`: must accept images and PDFs;
   - `AI_MODEL_AUDIO`: must accept audio input;
   - `AI_MODEL_EMBED`: embeddings.
3. Leave `AI_TRANSPORT` empty in production; production refuses fixture mode.
4. Verify with `npm run ai:eval`, which runs every task live and validates the outputs. Then re-index the
   knowledge base (Settings → Knowledge base) so it's embedded with the real model. Optionally run
   `npm run ai:record` to replace the hand-authored dev fixtures with recorded real outputs.

### Email / SMS (optional)
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM` (a verified domain), and `RESEND_WEBHOOK_SECRET` from a webhook
  pointing at `https://koryograph.ai/api/webhooks/resend`.
- **Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Set the messaging webhook
  (status and inbound) to `https://koryograph.ai/api/webhooks/twilio`.
- Without them, messages wait in Desk → Outbox with status "no provider" — by design.

### Web push (optional)
`npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `PUSH_CONTACT_EMAIL`
(a mailto contact for push services). Without them, Home notifications are in-app only, and the page says so.

### Vercel
1. Import the repo with root directory `apps/web`. The build command and output are detected; the scripts
   load env from the environment.
2. Environment variables: everything in `.env.example`, using the hosted values.
   - `NEXT_PUBLIC_APP_URL=https://koryograph.ai`
   - `NEXT_PUBLIC_ROOT_DOMAIN=koryograph.ai`
   - `NEXT_PUBLIC_COOKIE_DOMAIN=.koryograph.ai`
   - `CRON_SECRET`: a long random string. Vercel sends it to the crons.
3. **Domains:** `koryograph.ai`, `www.`, `desk.`, `app.` (Mat) and `home.`. Hosts map to surfaces in
   `src/proxy.ts`.
4. **Crons:** `apps/web/vercel.json` declares one cron per job, 17 in all. Several run every minute or every
   5 minutes, which needs a **Pro** plan; the Hobby plan only allows daily crons. Alternatively, point an
   external scheduler at `/api/jobs/<name>` with the bearer secret.
5. **Not wired:** no error tracking (Sentry etc.) or log drain. Add one before real schools use it.

## 2. Live smoke test
```bash
SMOKE_BASE_URL=https://koryograph.ai SMOKE_EMAIL=<an owner> SMOKE_PASSWORD=<…> SMOKE_API_KEY=<kg_live_…> \
SMOKE_EMAIL_TO=<your inbox> npm run smoke:live      # with the production env in .env.local or the shell
```
Each step prints PASS / FAIL / SKIP (a missing key skips; skips are not passes):
- health, with AI live;
- security headers: CSP nonce, HSTS, nosniff;
- sign-in with the tenant claim present, which confirms the auth hook;
- RLS: only your school's rows, and none anonymously;
- the public API key;
- Stripe: a $1 test charge and refund, plus the webhook endpoint enabled;
- `ai:eval`;
- a real email via Resend;
- cron auth, with a harmless job.

The key-gated browser specs set up and check their data in the **local** database, so run them locally with
the keys in `.env.local` (plus `stripe listen …` for Stripe):
`npm run dev` in one terminal, then `npx playwright test --grep "@stripe|@ai-live|@email"` in another.

**Deviation:** spec §7 lists a `billing_run` dry run. That job has no dry-run mode, so the smoke test
triggers the harmless `ai_models_sync` instead. The data-export ZIP is covered by the e2e suite.

## 3. HANDOFF items from the build

| Item | Why it's open | How to verify |
|---|---|---|
| Stripe keys + CLI | not provided / not installed on the build host | keys in env, `stripe listen …` (above), `npx playwright test --grep @stripe` |
| OpenRouter key | not provided — every AI result so far is a labelled dev fixture | `npm run ai:eval`; UI badges disappear |
| Resend / Twilio | not provided (optional) | smoke test email step; Desk → Outbox shows `sent` |
| Web push (VAPID) | no keys | Home → Notifications → Turn on push; send an in-app message |
| Platform subscription billing | not built (go-live records the plan) | — (future work) |
| Auth rate limits, MFA, password length 8 on the hosted project | project settings | Supabase dashboard (security review F2/F3/F6) |
| Outbound-webhook DNS-rebinding guard | open (F4) | resolve and pin IPs before connecting, or egress proxy |
| Error tracking / log drain | not wired | add Sentry or a Vercel log drain |
| Performance on hosted Postgres | measured locally only | `npx vitest run --project seed tests/seed/perf.test.ts` against a hosted copy of the demo seed |
| Vendor import presets (Spark, Zen Planner, Kicksite) | column names are assumptions | import a real export; fix mappings in `apps/web/src/lib/import/fields.ts` |
