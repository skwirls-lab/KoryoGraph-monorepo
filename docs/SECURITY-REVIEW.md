# Security review — KoryoGraph prototype (M5.08)

Executed 2026-09-25 against commit-in-progress on `claude/koryograph-build`. Automated checks are encoded in
`tests/unit/security.test.ts`, `tests/unit/honesty.test.ts`, `tests/unit/actions-guard.test.ts`,
`tests/db/guards.test.ts`, `tests/db/rls-matrix.test.ts` and `tests/security/bundle.test.ts` (run by
`npm run gate -- m5` after a production build). Findings are listed at the end with their status.

## Checklist

| # | Check | How it's verified | Result |
|---|---|---|---|
| 1 | Service-role client only in `server/admin/**`, `server/jobs/**`, `app/api/(stripe\|jobs\|webhooks)` | `honesty.test.ts` scans every import of `@koryo/db/service` | ✅ pass |
| 2 | Every server action starts with `getCtx()` / `require*()` | `actions-guard.test.ts` parses every exported function in `server/actions/**` (AST) | ✅ pass (unauthenticated public forms live in `server/public/**`, each rate-limited and honeypotted) |
| 3 | Tenant isolation in the database | `guards.test.ts` (RLS on every table, a policy per RLS table, audit trigger per tenant table), `rls-matrix.test.ts` (every role × tenant: no cross-tenant read or insert) | ✅ pass |
| 4 | Location scoping for staff | restrictive RLS on 17 location tables + attendance/bookings; `multi-location.test.ts` | ✅ pass |
| 5 | Inbound webhook signatures | Stripe `constructEvent` (STRIPE_WEBHOOK_SECRET), Resend Svix, Twilio `X-Twilio-Signature`; routes refuse unsigned requests | ✅ pass (`security.test.ts` pins the reviewed route list) |
| 6 | Outbound webhooks | HMAC-SHA256 `t=…,v1=…` signature; https only and internal/private destinations refused in production; retries with backoff | ✅ pass (unit + e2e) |
| 7 | Kiosk lockout | household PIN: 5 wrong attempts → locked 15 minutes; staff PIN the same pattern; kiosks are paired devices with a revocable token | ✅ pass |
| 8 | Rate limits | `/api/v1`: 120 req/min per key (in SQL); public trial form / booking widget: duplicate-submission limit per lead per hour; `/contact`: 5/hour per email; auth: Supabase GoTrue limits (`[auth.rate_limit]`) | ✅ pass — see finding F3 for production auth values |
| 9 | Security headers | CSP with per-request nonce + `'strict-dynamic'` (no `unsafe-inline` scripts), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` (public trial form: `*`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (camera/mic self only), HSTS in production; `X-Powered-By` off | ✅ pass; browsed Desk, POS, reports, Home and the public site with zero CSP violations |
| 10 | Dependency audit | `npm audit --omit=dev` | ✅ 0 vulnerabilities (2026-09-25); the gate fails on high/critical |
| 11 | No secrets in the client bundle | production build (`NEXT_DIST_DIR=.next-audit`), scan of every static chunk for the real values of 10 server secrets and for `sk_*`, `whsec_*`, `service_role`, DB URLs | ✅ pass after fix F1 |
| 12 | No secret-looking `NEXT_PUBLIC_*` variables; no hard-coded live keys | `security.test.ts` | ✅ pass |
| 13 | Minors' media & AI | recording / technique submissions refused in the database without a guardian's AI-processing consent; teens can't consent for themselves; AI import mapping sees column names only | ✅ pass (DB tests) |
| 14 | Secrets at rest | API keys stored as SHA-256 only; kiosk/staff PINs bcrypt (`crypt`); guest-waiver links store token hashes; AI conversation text redacted in the audit log | ✅ pass |

## Findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| F1 | The browser Supabase client imported the shared env module, so the *name* `SUPABASE_SERVICE_ROLE_KEY` (in a validation message) shipped to the client. No value leaked. | Low | **Fixed** — public and service env split (`public-env.ts` / `service-env.ts`, the latter `server-only`) |
| F2 | Supabase Auth allowed 6-character passwords (the app's forms require 8). | Low | **Fixed** in `supabase/config.toml` (8); set the same in the hosted project (HANDOFF) |
| F3 | Local auth rate limits are loose (for tests). | Medium in production | **HANDOFF** — set production limits in the Supabase dashboard (e.g. sign-ins 30/5 min per IP, email 30/h) |
| F4 | Outbound webhook destination checks are by hostname/IP literal; a public name that resolves to a private address (DNS rebinding) isn't caught. | Medium | **Open** — resolve and pin the IP before connecting, or send through an egress proxy |
| F5 | Webhook endpoint signing secrets are stored in plain text (needed to sign). Readable only with `settings.manage` via RLS. | Low | Accepted; consider Supabase Vault |
| F6 | No MFA for staff accounts. | Medium | **HANDOFF** — enable Supabase MFA (TOTP) and require it for owner/admin |
| F7 | `style-src 'unsafe-inline'` (Tailwind/Radix inline styles). | Low | Accepted |
| F8 | Production deployment settings (HTTPS-only cookies, `NEXT_PUBLIC_COOKIE_DOMAIN`, CRON_SECRET rotation, Stripe restricted keys) are environment configuration. | — | HANDOFF — documented in `docs/HANDOFF.md` |
