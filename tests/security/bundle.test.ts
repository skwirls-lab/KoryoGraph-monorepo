import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// M5.08: nothing secret reaches the browser. Runs against a production build in apps/web/.next-audit
// (the M5 gate builds it with NEXT_DIST_DIR=.next-audit first).
const STATIC = path.resolve(import.meta.dirname, "../../apps/web/.next-audit/static");
const files = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? files(p) : [p]; });

describe("client bundle", () => {
  it("contains no server secrets", () => {
    expect(existsSync(STATIC), "no production build — run: NEXT_DIST_DIR=.next-audit npm run build -w @koryo/web").toBe(true);
    const all = files(STATIC).filter((f) => /\.(js|css|json|html|txt|map)$/.test(f));
    expect(all.length).toBeGreaterThan(10);
    const secretValues = ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "OPENROUTER_API_KEY", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET",
      "TWILIO_AUTH_TOKEN", "CRON_SECRET", "VAPID_PRIVATE_KEY", "SUPABASE_DB_URL"]
      .map((k) => [k, process.env[k] ?? ""] as const).filter(([, v]) => v.length >= 12);
    const patterns = [/sk_(test|live)_[A-Za-z0-9]{10,}/, /whsec_[A-Za-z0-9]{10,}/, /SERVICE_ROLE/, /service_role/, /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/];
    const hits: string[] = [];
    for (const f of all) {
      const s = readFileSync(f, "utf8");
      for (const [k, v] of secretValues) if (s.includes(v)) hits.push(`${path.relative(STATIC, f)}: value of ${k}`);
      for (const re of patterns) if (re.test(s)) hits.push(`${path.relative(STATIC, f)}: ${re.source}`);
    }
    expect(hits).toEqual([]);
  });
});
