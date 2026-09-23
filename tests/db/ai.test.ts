import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
const R = sid("tenant:ridgeline");
const H = sid("tenant:harbor");
const run = (task: string, cost: number) => ({ task_id: task, tier: "fast", model: "fixture", transport: "fixture", status: "ok", input_hash: "abc", input: { q: 1 }, output: { a: 1 }, tokens_in: 10, tokens_out: 5, cost_cents: cost, latency_ms: 3, attempts: 1 });

afterAll(async () => {
  await sql`delete from ai_runs where task_id like 'dbtest_%'`;
  await sql`delete from tenant_ai_budgets where tenant_id = ${R}`;
  await sql.end();
});

describe("AI runs and budgets", () => {
  it("any member logs their own runs into their own tenant; only settings.manage reads them", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const [{ id } = { id: "" }] = await asClaims(parent, (tx) => tx<{ id: string }[]>`select public.log_ai_run(${sql.json(run("dbtest_home", 0.5))}) as id`);
    const [row] = await sql`select tenant_id, user_id, status, cost_cents::float as cost from ai_runs where id = ${id}`;
    expect(row).toMatchObject({ tenant_id: R, status: "ok", cost: 0.5 });
    expect(row?.user_id).toBe((parent as { sub: string }).sub);
    expect(await asClaims(parent, (tx) => tx`select id from ai_runs`)).toHaveLength(0);
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const seen = await asClaims(owner, (tx) => tx<{ tenant_id: string }[]>`select tenant_id from ai_runs where task_id like 'dbtest_%'`);
    expect(seen.length).toBeGreaterThan(0);
    const harborOwner = await seededClaims("owner@harborbjj.demo");
    expect(await asClaims(harborOwner, (tx) => tx`select id from ai_runs where tenant_id = ${R}`)).toHaveLength(0);
    const { error } = await anon.rpc("log_ai_run", { p: run("dbtest_anon", 1) });
    expect(error).not.toBeNull();
  });

  it("budget status: default limit, this month's spend, tenant override; the job variant is service-only", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const before = await asClaims(owner, (tx) => tx<{ limit_cents: number; used_cents: string }[]>`select * from public.ai_budget_status()`);
    await asClaims(owner, (tx) => tx`select public.log_ai_run(${sql.json(run("dbtest_spend", 12.25))})`);
    const after = await asClaims(owner, (tx) => tx<{ limit_cents: number; used_cents: string }[]>`select * from public.ai_budget_status()`);
    expect(Number(after[0]?.used_cents) - Number(before[0]?.used_cents)).toBeCloseTo(12.25);
    expect(after[0]?.limit_cents).toBe(5000);
    await asClaims(owner, (tx) => tx`insert into tenant_ai_budgets (tenant_id, monthly_limit_cents) values (${R}, 1234) on conflict (tenant_id) do update set monthly_limit_cents = 1234`);
    const [capped] = await asClaims(owner, (tx) => tx<{ limit_cents: number }[]>`select * from public.ai_budget_status()`);
    expect(capped?.limit_cents).toBe(1234);
    const harbor = await sql<{ used_cents: string }[]>`select * from public.ai_budget_status_for(${H})`;
    expect(Number(harbor[0]?.used_cents)).toBe(0);
    await expect(asClaims(owner, (tx) => tx`select * from public.ai_budget_status_for(${R})`)).rejects.toThrow(/permission denied/);
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`insert into tenant_ai_budgets (tenant_id, monthly_limit_cents) values (${R}, 999999) on conflict (tenant_id) do update set monthly_limit_cents = 999999`)).rejects.toThrow();
  });
});
