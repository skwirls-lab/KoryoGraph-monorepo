# KoryoGraph build progress
Branch: claude/koryograph-build · Started: 2026-09-22 · Spec: KORYOGRAPH-BUILD.md v1.0

## Current task
M5.08 security review

## Preflight
Run 2026-09-22 on the build host (linux aarch64, 20 cores, 121 GB RAM).

```
node -v            → v22.23.1   OK
npm -v             → 10.9.8     OK
docker info        → OK
supabase --version → not on PATH; `npx supabase@2.117.0` works (added as a root devDependency) — OK
stripe --version   → NOT INSTALLED → HANDOFF (webhook forwarding via `stripe listen`)
.env.local         → absent → created from .env.example with local stack keys
STRIPE_SECRET_KEY  → missing → HANDOFF
OPENROUTER_API_KEY → missing → HANDOFF (AI runs on the fixture transport in tests; UI states "no key")
Resend / Twilio    → missing → Outbox (by design)
git status         → 0 dirty files
port 3000          → in use by another container on the host → dev server uses :3100 (ADR-0002)
```

## Milestones
| Milestone | Status | Gate result | Tag | Date |
|---|---|---|---|---|
| M0 | done | GREEN (typecheck, lint, unit 16, db 22, e2e 14) | m0-complete | 2026-09-22 |
| M1 | done | GREEN (typecheck, lint, unit, db, seed demo + invariants, e2e m0–m1) | m1-complete | 2026-09-23 |
| M2 | done | GREEN (typecheck, lint, unit 167, billing coverage 100%, db 98, seed demo + invariants 11, e2e m0–m2 54; @stripe/@ai-live/@email = HANDOFF) | m2-complete | 2026-09-23 |
| M3 | done | GREEN (typecheck, lint, unit 167, billing coverage 100%, db 124, seed demo + invariants 13, e2e m0–m3 63; @stripe/@ai-live/@email = HANDOFF) | m3-complete | 2026-09-23 |
| M4 | done | GREEN (typecheck, lint, unit 204+76, billing coverage 100%, db 141, seed demo + invariants 14, e2e m0–m4 80; ai:eval HANDOFF (no key); @stripe/@ai-live/@email = HANDOFF) | m4-complete | 2026-09-23 |
| M5 | in_progress |  |  |  |

## Tasks
| Task | Status (todo/doing/done/blocked) | Commit | Notes |
|---|---|---|---|
| M0.01 | done | 76587c2 |  |
| M0.02 | done | cfbb381 | state files were silently ignored by a root `build` gitignore pattern until the M0 gate; fixed and committed then |
| M0.03 | done | 2b47745 |  |
| M0.04 | done | e0a18a5 |  |
| M0.05 | done | 724039a |  |
| M0.06 | done | 271e4df |  |
| M0.07 | done | 26c64f3 |  |
| M0.08 | done | eaa7459 |  |
| M0.09 | done | 44d7b8e | reordered before M0.10 (gate needs seed) |
| M0.10 | done | b69710f |  |
| M0.11 | done | c4295af |  |
| M0.12 | done | 30c914d |  |
| M1.01 | done | 2f99036 |  |
| M1.02 | done | 5c9becf |  |
| M1.03 | done | 4f63072 | attendance trigger attaches in M1.06 |
| M1.04 | done | e20a9ff |  |
| M1.05 | done | 674f0ac |  |
| M1.06 | done | fb8abb2 |  |
| M1.07 | done | 0cd8f2c | comms foundation pulled in (ADR-0011) |
| M1.08 | done | 0c9e0cb |  |
| M1.09 | done | 82ee66a |  |
| M1.10 | done | 403c38d |  |
| M1.11 | done | d6b8673 |  |
| M1.12 | done | cd03e33 |  |
| M1.13 | done | f09919e |  |
| M1.14 | done | 856e197 |  |
| M1.15 | done | 9a18242 |  |
| M2.01 | done | 1a38304 |  |
| M2.02 | done | 7aec28d |  |
| M2.03 | done | 773f929 | stripe.spec (@stripe) needs STRIPE_* keys + STRIPE_TEST_CONNECTED_ACCOUNT → HANDOFF |
| M2.04 | done | fb399cf | card-payment variant of enroll.spec is @stripe (HANDOFF) |
| M2.05 | done | de0391c | autopay charges need Stripe keys (HANDOFF); job records the skip honestly |
| M2.06 | done | 19eef37 | card retry path is @stripe (HANDOFF) |
| M2.07 | done | 66e4d9b | @stripe pay-invoice spec needs keys + stripe listen (HANDOFF) |
| M2.08 | done | 686b2bc |  |
| M2.09 | done | 1c76520 | Terminal + card-on-file tenders need Stripe keys (HANDOFF) |
| M2.10 | done | 97f51b6 |  |
| M2.11 | done | 9115ee0 |  |
| M2.12 | done | 0f1b02c | gate green after 3 fixes found by demo data (walk-in household, cardLabel server/client, spec assumptions) |
| M3.01 | done | def8a3d |  |
| M3.02 | done | 232e210 |  |
| M3.03 | done | 7104c71 |  |
| M3.04 | done | eb28b7c | events/camps/parties; DB 5 tests, e2e events.spec 2 tests green |
| M3.05 | done | f43df68 | after-school; DB 4 tests, e2e afterschool.spec green |
| M3.06 | done | 120c7ae | staff ops; DB 5 tests, e2e staff.spec green; staff invites stay in M5.02 |
| M3.07 | done | 5e19608 | growth reports; DB 5 tests vs SQL truth; e2e growth-reports.spec |
| M3.08 | done | f4279b0 | demo seed v3; seed invariants 13/13 incl. determinism; Youth TKD 14 eligible / 17 almost (ADR-0029) |
| M3.09 | done | 1178152 | gate green after 1 fix (staff_profiles collision between db tests and demo seed) |
| M4.01 | done | 1a32f0c | gateway; no key → fixture mode; ai:eval HANDOFF; model tiers env-only (ADR-0030) |
| M4.02 | done | 697d27c | approvals; DB 2, e2e approvals.spec |
| M4.03 | done | ce74272 | KB; 'refund policy' → refund policy first |
| M4.04 | done | ed1806d | copilot + home assistant; fixtures hand-authored |
| M4.05 | done | b1da63e | drift; 6 high on demo, all fixture drafts; Riley medium (shaped in M4.12) |
| M4.06 | done | bb450b1 | action board; 9/3/1 acceptance green |
| M4.07 | done | 2f83786 | lesson builder |
| M4.08 | done | 3d04605 | packing-slip intake; import mapping assist built with the importer in M5.03 |
| M4.09 | done | 2eac560 | NL reports; two-layer guard |
| M4.10 | done | 5e25f2d | Billing recovery (off/approve/auto, template fallback), weekly parent narratives → Home after approval, rule-based lead score + AI next step; ADR-0035 |
| M4.11 | done | 77f5a5a | Technique feedback (consent, ffmpeg keyframes, vision rubric, Mat release, gold clips) + schedule suggestions card; ai_transport on reviewed rows; ADR-0036 |
| M4.12 | done | 98ed320 | Demo seed v4 via real jobs/actions (fixtures); Riley #1; 9/3/1 board; ADR-0037 |
| M5.01 | done | 2885634 | Public site; prices on modules table; contact inbox (no admin UI yet); ADR-0038 |
| M5.02 | done | 6ed2db4 | Onboarding wizard; invites via Supabase Auth + /auth/accept; go_live (platform billing HANDOFF); ADR-0039 |
| M5.03 | done | 6535b3c | CSV importer; presets are assumptions; attendance history not imported (count only); ADR-0040 |
| M5.04 | done | 8268a43 | Public API v1 + signed webhooks; DNS-rebinding not handled (noted); ADR-0041 |
| M5.05 | done | c2cd8a9 | PWA + notifications; web push HANDOFF (no VAPID keys); ADR-0042 |
| M5.06 | done | 698bcce | Multi-location RLS + switcher + rollup; ADR-0043 |
| M5.07 | done | 5279bfb | a11y + perf; ADR-0044 |
| M5.08 | todo |  |  |
| M5.09 | todo |  |  |
| M5.10 | todo |  |  |
| M5.11 | todo |  |  |

## Blocked
| Task | Diagnosis | Needs |
|---|---|---|

## HANDOFF items
| Item | Why | How to verify |
|---|---|---|
| Stripe CLI | Not installed on build host | `stripe --version`; `stripe listen --forward-to localhost:3100/api/stripe/webhook` |
| STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Not provided | Add test keys to `.env.local`; run `npx playwright test --grep @stripe` |
| OPENROUTER_API_KEY | Not provided | Add key to `.env.local`; run `npm run ai:eval` |
| RESEND_API_KEY / TWILIO_* | Not provided (optional) | Add keys; send a test from Desk → Outbox → Resend |

## Deviations (see DECISIONS.md for detail)
- ADR-0001 Consolidate to single app; Supabase platform; OpenRouter
- ADR-0002 Dev server on port 3100; working branch `claude/koryograph-build`; Supabase CLI via npm
- ADR-0003 `@supabase/ssr` 0.12.x instead of ^0.5 (0.5 line is superseded; same getAll/setAll API)
