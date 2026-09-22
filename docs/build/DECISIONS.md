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
