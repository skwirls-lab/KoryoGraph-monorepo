// `npm run smoke:live` — checks a deployed KoryoGraph against real services (§7). Each step prints PASS, FAIL
// or SKIP (a key or setting isn't provided). Exit code 1 if anything FAILs. Nothing here uses fixtures.
//
// Env: SMOKE_BASE_URL (e.g. https://koryograph.ai), NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// (the hosted project), SMOKE_EMAIL / SMOKE_PASSWORD (an owner account), CRON_SECRET, and optionally
// SMOKE_API_KEY (a kg_live_ key for that school), STRIPE_SECRET_KEY (test mode), OPENROUTER_API_KEY,
// RESEND_API_KEY + RESEND_FROM + SMOKE_EMAIL_TO.
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { loadEnv } from "./lib/env";

loadEnv();
type Status = "PASS" | "FAIL" | "SKIP";
const results: { step: string; status: Status; detail: string }[] = [];
const env = (k: string) => process.env[k]?.trim() || "";
const base = env("SMOKE_BASE_URL").replace(/\/$/, "");

async function step(name: string, need: string[], fn: () => Promise<string>): Promise<void> {
  const missing = need.filter((k) => !env(k));
  if (missing.length) { results.push({ step: name, status: "SKIP", detail: `set ${missing.join(", ")}` }); return; }
  try {
    results.push({ step: name, status: "PASS", detail: await fn() });
  } catch (err) {
    results.push({ step: name, status: "FAIL", detail: err instanceof Error ? err.message : String(err) });
  }
}
const must = (cond: unknown, msg: string | undefined) => { if (!cond) throw new Error(msg ?? "check failed"); };

let claims: { tenant_id?: string } = {};
const supabase = () => createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const userDb = supabase();

await step("health", ["SMOKE_BASE_URL"], async () => {
  const r = await fetch(`${base}/api/health`);
  const j = (await r.json()) as { status: string; ai: { transport: string } };
  must(r.ok && j.status === "ok", `health ${r.status}`);
  must(j.ai.transport === "live", `AI transport is "${j.ai.transport}" — set OPENROUTER_API_KEY on the deployment`);
  return "ok, AI live";
});

await step("security headers", ["SMOKE_BASE_URL"], async () => {
  const r = await fetch(`${base}/login`);
  const csp = r.headers.get("content-security-policy") ?? "";
  must(/'nonce-[^']+'/.test(csp) && csp.includes("frame-ancestors 'self'"), "CSP with nonce missing");
  must(r.headers.get("strict-transport-security"), "HSTS missing (production build over https?)");
  must(r.headers.get("x-content-type-options") === "nosniff", "nosniff missing");
  return "CSP (nonce), HSTS, nosniff";
});

await step("auth sign-in → tenant claim", ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SMOKE_EMAIL", "SMOKE_PASSWORD"], async () => {
  const { data, error } = await userDb.auth.signInWithPassword({ email: env("SMOKE_EMAIL"), password: env("SMOKE_PASSWORD") });
  must(!error && data.session, `sign-in failed: ${error?.message}`);
  const payload = JSON.parse(Buffer.from((data.session?.access_token ?? "").split(".")[1] ?? "", "base64url").toString()) as { app_metadata?: { tenant_id?: string } };
  claims = payload.app_metadata ?? {};
  must(claims.tenant_id, "no tenant_id claim — enable the custom access token hook (Auth → Hooks)");
  return `tenant ${claims.tenant_id}`;
});

await step("RLS: only my school's rows", ["NEXT_PUBLIC_SUPABASE_URL", "SMOKE_EMAIL", "SMOKE_PASSWORD"], async () => {
  must(claims.tenant_id, "needs a signed-in user");
  const { data: people, error } = await userDb.from("people").select("tenant_id").limit(1000);
  must(!error, error?.message);
  must((people ?? []).every((p) => p.tenant_id === claims.tenant_id), "saw another school's people");
  const anon = supabase();
  const { data: leaked } = await anon.from("people").select("id").limit(1);
  must(!leaked?.length, "anonymous client can read people");
  return `${people?.length ?? 0} people, all this school's; anonymous sees none`;
});

await step("public API key", ["SMOKE_BASE_URL", "SMOKE_API_KEY"], async () => {
  const r = await fetch(`${base}/api/v1/people?limit=5`, { headers: { authorization: `Bearer ${env("SMOKE_API_KEY")}` } });
  must(r.ok, `GET /api/v1/people → ${r.status}`);
  const bad = await fetch(`${base}/api/v1/people`, { headers: { authorization: "Bearer kg_live_AAAAAAAA_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } });
  must(bad.status === 401, `invalid key → ${bad.status}, expected 401`);
  return "200 with the key, 401 without";
});

await step("Stripe (test mode): $1 charge + refund; webhook endpoint registered", ["STRIPE_SECRET_KEY", "SMOKE_BASE_URL"], async () => {
  must(env("STRIPE_SECRET_KEY").startsWith("sk_test_"), "use a test-mode key for the smoke test");
  const stripe = new Stripe(env("STRIPE_SECRET_KEY"));
  const pi = await stripe.paymentIntents.create({ amount: 100, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, description: "KoryoGraph smoke test" });
  must(pi.status === "succeeded", `charge ${pi.status}`);
  const refund = await stripe.refunds.create({ payment_intent: pi.id });
  must(refund.status === "succeeded" || refund.status === "pending", `refund ${refund.status}`);
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  must(hooks.data.some((h) => h.url === `${base}/api/stripe/webhook` && h.status === "enabled"), `no enabled webhook endpoint for ${base}/api/stripe/webhook`);
  return `${pi.id} charged and refunded; webhook endpoint enabled`;
});

await step("OpenRouter: ai:eval (every task, live)", ["OPENROUTER_API_KEY"], async () => {
  const r = spawnSync("npm", ["run", "-s", "ai:eval"], { stdio: "pipe", encoding: "utf8", env: process.env });
  must(r.status === 0, (r.stdout + r.stderr).split("\n").filter((l) => /FAILED|error/i.test(l)).slice(0, 3).join(" ") || `ai:eval exit ${r.status}`);
  return (r.stdout.split("\n").find((l) => l.startsWith("ai:eval")) ?? "passed").trim();
});

await step("email via Resend", ["RESEND_API_KEY", "RESEND_FROM", "SMOKE_EMAIL_TO"], async () => {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env("RESEND_FROM"), to: env("SMOKE_EMAIL_TO"), subject: "KoryoGraph smoke test", text: "If you can read this, outbound email works." }),
  });
  must(r.ok, `Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return `sent to ${env("SMOKE_EMAIL_TO")}`;
});

await step("cron auth + a harmless job (ai_models_sync)", ["SMOKE_BASE_URL", "CRON_SECRET"], async () => {
  const denied = await fetch(`${base}/api/jobs/ai_models_sync`);
  must(denied.status === 401, `unauthenticated job call → ${denied.status}, expected 401`);
  const r = await fetch(`${base}/api/jobs/ai_models_sync`, { headers: { authorization: `Bearer ${env("CRON_SECRET")}` } });
  must(r.ok, `job → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return "401 without the secret, 200 with it";
});

const width = Math.max(...results.map((r) => r.step.length));
for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.step.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => r.status === "FAIL").length;
const skipped = results.filter((r) => r.status === "SKIP").length;
console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped (missing keys are not passes)`);
process.exit(failed ? 1 : 0);
