# Runbook

How to operate a KoryoGraph deployment. For first-time setup see [HANDOFF.md](HANDOFF.md).

## Scheduled jobs
Every job is a function in `apps/web/src/server/jobs/` and a row in `public.jobs`. Vercel Cron calls
`GET /api/jobs/<name>` with `Authorization: Bearer $CRON_SECRET` on the schedules in `apps/web/vercel.json`, which
a unit test keeps identical to the database. Each run writes a `job_runs` row: status, stats, error.

| Job | Schedule (UTC) | What it does |
|---|---|---|
| `materialize_sessions` | 03:00 daily | expands class templates into sessions for the next 90 days |
| `billing_run` | 06:00 daily | invoices memberships due today, updates states, attempts autopay |
| `dunning` | 06:30 daily | retries failed payments, sends notices (or AI-drafted follow-ups), suspends at the final step |
| `outbox_dispatch` | every 5 min | sends queued email/SMS/in-app messages (consent, quiet hours, providers); web push if VAPID keys |
| `automations` | every 5 min | runs due automation steps |
| `signature_pdfs` | every 5 min | renders signed documents to PDF |
| `data_export` | every minute | builds requested full-school export ZIPs |
| `webhook_dispatch` | every minute | delivers outbound webhooks (HMAC-signed, retried for ~15 h) |
| `transcribe`, `technique_feedback` | every minute | class recordings → action boards; practice clips → feedback drafts |
| `afterschool_cutoff` | every 10 min | after-school absence alerts |
| `lead_scoring` | every 15 min | scores new/changed leads, suggests a next step |
| `drift_score` | 02:15 daily | risk scores and drafted outreach |
| `kb_schedule_digest` | 03:30 daily | refreshes the knowledge base's schedule document |
| `ai_models_sync` | 04:00 daily | model prices from OpenRouter |
| `schedule_suggestions` | Mondays 06:00 | timetable suggestions |
| `parent_narratives` | Fridays 16:00 | weekly family updates (drafts for approval) |

- **Run one now:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/<name>`. Add
  `?tenant=<uuid>` to limit the run to one school. Locally, use `npm run jobs:tick -- --force <name>`.
- **See failures:** `select job_name, started_at, error from job_runs where status = 'error' order by started_at desc limit 20;`
  Platform admins can read `job_runs`.
- Jobs are idempotent: re-running `billing_run` for the same day doesn't double-invoice, and dunning steps
  record what they did.

## Webhooks
- **Stripe → us:** `POST /api/stripe/webhook`, verified with `STRIPE_WEBHOOK_SECRET`. Connect events come from
  connected accounts, so the endpoint must listen to *Connected accounts* as well as the platform account.
  Events handled:
  - `account.updated`
  - `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, `payment_intent.canceled`
  - `setup_intent.succeeded`, `setup_intent.setup_failed`
  - `payment_method.attached`, `payment_method.updated`, `payment_method.detached`
  - `charge.refunded`
  - `customer.created`, `customer.updated`, `customer.deleted`
  Processed events are stored with their Stripe id, so redeliveries are ignored. Replay from the Stripe
  dashboard is safe.
- **Resend / Twilio → us:** delivery status and inbound SMS at `/api/webhooks/resend` (Svix signature) and
  `/api/webhooks/twilio` (X-Twilio-Signature).
- **Us → schools' systems:** endpoints are configured per school in Desk → Settings → API & webhooks.
  - Deliveries are visible there and in `webhook_deliveries`.
  - A failed delivery retries after 1 min, 5 min, 30 min, 2 h and 12 h, then is marked `failed` with the
    last error.

## Stripe Connect
- Each school connects its own **Standard** account in Desk → Settings → Payments. Families' payments go to
  that account. KoryoGraph takes `STRIPE_PLATFORM_FEE_BPS` as an application fee; 0 means none.
- If a school says "payments stopped": check `tenants.stripe_onboarding_complete`. `account.updated` keeps it
  current. The school may need to finish requirements in their Stripe dashboard; the Payments page shows a
  fresh onboarding link.
- **Refunds:** from the invoice or POS sale in Desk; they go through Stripe and come back via
  `charge.refunded`.
- **Card readers:** Stripe Terminal readers are registered per school. They need a location address
  (Settings → Location).

## AI
- Every run goes through `packages/ai` to OpenRouter and is logged in `ai_runs` with task, model, tokens,
  cost and status. Schools set a monthly budget in Desk → Settings → AI; calls over budget are refused and
  logged as such.
- **Models:** chosen per deployment with `AI_MODEL_FAST`, `_FRONTIER`, `_VISION`, `_AUDIO` and `_EMBED`
  (OpenRouter ids); there are no built-in defaults. Prices come from `ai_models_sync`.
- **Check the whole AI layer:** `npm run ai:eval` runs every task's examples live and checks the outputs
  against their schemas.
- **Nothing is sent without approval:** drafts wait in Approvals. The only exception is billing recovery set
  to "auto" by the school, and even that only after it has approved one draft.
- Without a key the app runs on recorded **dev fixtures**, always labelled as such. Production refuses
  fixture mode.

## Backups and data
- **Postgres:** Supabase daily backups, or PITR on paid plans; check it's enabled in the project settings.
  A logical dump: `supabase db dump --linked -f backup.sql` (schema) plus `--data-only` (data).
- **Storage:** the `tenant-media` bucket holds documents, signatures, recordings, clips, logos and imports.
  It isn't in database backups; mirror it with `supabase storage cp -r` or an S3-compatible sync.
- **A school's own data:** Desk → Settings → Data export builds a ZIP of everything (the `data_export` job).
- **Import rollback:** Desk → People → Import → Roll back deletes everything that import created.

## Access and accounts
- **Platform admins:** add the user id to `platform_admins`. They can read `job_runs` and `contact_messages`.
- **Staff:** invited from Desk → Staff; they accept on `/welcome`. With Multi-location, a staff member's
  locations limit what they see, enforced by RLS.
- **Lost kiosk:** Desk → Settings → Kiosk devices → revoke.
- **Leaked API key:** revoke it in Settings → API & webhooks; it stops working at once.
