import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../apps/web/src/lib/csp";

// M5.08 security review, encoded (docs/SECURITY-REVIEW.md). The service-role and server-action guards live in
// honesty.test.ts and actions-guard.test.ts; the client-bundle scan in tests/security (run by the M5 gate).
const ROOT = path.resolve(import.meta.dirname, "../..");
const walk = (dir: string, re: RegExp): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (["node_modules", ".next", ".next-audit", ".turbo"].includes(n)) return [];
    return statSync(p).isDirectory() ? walk(p, re) : re.test(n) ? [p] : [];
  });
const read = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => path.relative(ROOT, p);

describe("security review", () => {
  it("no secret-looking variable is exposed to the browser (NEXT_PUBLIC_*)", () => {
    const sources = [path.join(ROOT, ".env.example"), ...walk(path.join(ROOT, "apps/web/src"), /\.(ts|tsx)$/), ...walk(path.join(ROOT, "packages"), /\.(ts|tsx)$/)];
    const bad = new Set<string>();
    for (const f of sources) for (const m of read(f).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) if (/SECRET|PRIVATE|SERVICE|TOKEN|PASSWORD|WEBHOOK/.test(m[0])) bad.add(`${rel(f)}: ${m[0]}`);
    expect([...bad]).toEqual([]);
  });

  it("no live-looking secrets are hard-coded in app or package code", () => {
    const hits: string[] = [];
    for (const f of [...walk(path.join(ROOT, "apps/web/src"), /\.(ts|tsx|js)$/), ...walk(path.join(ROOT, "packages"), /\.(ts|tsx)$/)]) {
      const s = read(f);
      for (const re of [/sk_live_[A-Za-z0-9]{8,}/, /rk_live_[A-Za-z0-9]{8,}/, /sk_test_[A-Za-z0-9]{24,}/, /whsec_[A-Za-z0-9]{24,}/, /eyJhbGciOi[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}/, /sk-or-v1-[a-f0-9]{20,}/]) {
        if (re.test(s)) hits.push(`${rel(f)}: ${re.source}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("CSP: nonce-based scripts (no unsafe-inline), no plugins, framing only for the public trial form", () => {
    const csp = contentSecurityPolicy("abc123", "/desk", { supabaseUrl: "https://x.supabase.co", dev: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(contentSecurityPolicy("n", "/s/ridgeline/trial", { supabaseUrl: "https://x.supabase.co", dev: false })).toContain("frame-ancestors *");
  });

  it("every API route is on the reviewed list with its authentication", () => {
    // Adding a route under app/api means adding it here — i.e. deciding how it's authenticated.
    const REVIEWED: Record<string, string> = {
      "health/route.ts": "public; reports configuration presence only (no data, no secrets)",
      "jobs/[name]/route.ts": "Bearer CRON_SECRET",
      "stripe/webhook/route.ts": "Stripe signature (STRIPE_WEBHOOK_SECRET)",
      "v1/[resource]/route.ts": "API key, resolved and scoped in SQL (api_list); 120/min",
      "v1/openapi.json/route.ts": "public description, no data",
      "webhooks/resend/route.ts": "Svix signature (RESEND_WEBHOOK_SECRET)",
      "webhooks/twilio/route.ts": "X-Twilio-Signature (TWILIO_AUTH_TOKEN)",
    };
    const dir = path.join(ROOT, "apps/web/src/app/api");
    expect(walk(dir, /^route\.ts$/).map((f) => path.relative(dir, f)).sort()).toEqual(Object.keys(REVIEWED).sort());
    expect(read(path.join(dir, "jobs/[name]/route.ts"))).toMatch(/CRON_SECRET/);
    expect(read(path.join(dir, "stripe/webhook/route.ts"))).toMatch(/constructEvent|signature/i);
    expect(read(path.join(dir, "webhooks/resend/route.ts"))).toMatch(/svix/i);
    expect(read(path.join(dir, "webhooks/twilio/route.ts"))).toMatch(/validateTwilioSignature|X-Twilio-Signature/i);
  });

  it("rate limits and lockouts exist where the spec requires them", () => {
    const sql = walk(path.join(ROOT, "supabase/migrations"), /\.sql$/).map(read).join("\n");
    expect(sql).toMatch(/rate limit exceeded/); // /api/v1: 120 per key per minute
    expect(sql).toMatch(/locked_until/); // kiosk household PINs lock after repeated failures
    expect(sql).toMatch(/kind = 'form' and at > now\(\) - interval '1 hour'/); // public trial form / widget
    expect(sql).toMatch(/several messages from you in the last hour/); // /contact
    const auth = read(path.join(ROOT, "supabase/config.toml"));
    expect(auth).toMatch(/\[auth\.rate_limit\]/); // sign-in, sign-up, OTP and email rate limits (GoTrue)
  });

  it("security headers are configured", () => {
    const cfg = read(path.join(ROOT, "apps/web/next.config.ts"));
    for (const h of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security", "X-Frame-Options"]) expect(cfg).toContain(h);
    expect(cfg).toContain("poweredByHeader: false");
    expect(read(path.join(ROOT, "apps/web/src/proxy.ts"))).toContain("content-security-policy");
  });
});
