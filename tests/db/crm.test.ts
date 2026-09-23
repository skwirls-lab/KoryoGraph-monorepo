import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "../../packages/db/src/types";
import { sql } from "./harness";

const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
const tag = randomUUID().slice(0, 6);

afterAll(async () => {
  await sql`delete from people where last_name like ${`Crm${tag}%`}`;
  await sql.end();
});

describe("public trial form (anon)", () => {
  it("every tenant has the default pipeline", async () => {
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from tenants t where not exists (select 1 from pipeline_stages s where s.tenant_id = t.id and s.key = 'won')`;
    expect(r?.n).toBe(0);
  });

  it("creates a lead in New, merges duplicates by phone, and ignores the honeypot", async () => {
    const submit = (p: Record<string, string>) => anon.rpc("submit_trial_request", { p_slug: "ridgeline", p });
    const first = await submit({ first_name: "Sam", last_name: `Crm${tag}`, phone: "(555) 123-4567" });
    expect(first.error).toBeNull();
    const again = await submit({ first_name: "Samuel", last_name: `Crm${tag}b`, phone: "555.123.4567", message: "second try" });
    expect(again.data).toMatchObject({ ok: true, merged: true });
    const bot = await submit({ first_name: "Bot", last_name: `Crm${tag}bot`, email: `bot${tag}@example.test`, website: "http://spam" });
    expect(bot.error).toBeNull();
    const rows = await sql<{ key: string; last_name: string }[]>`select st.key, p.last_name from leads l join people p on p.id = l.person_id join pipeline_stages st on st.id = l.stage_id where p.last_name like ${`Crm${tag}%`}`;
    expect(rows).toEqual([{ key: "new", last_name: `Crm${tag}` }]);
  });

  it("a school without Grow isn't reachable; anon can't read or write CRM tables directly", async () => {
    const harbor = await anon.rpc("submit_trial_request", { p_slug: "harbor", p: { first_name: "X", email: `x${tag}@example.test` } });
    expect(harbor.error?.message).toMatch(/unknown school/);
    expect((await anon.rpc("public_trial_info", { p_slug: "harbor" })).data).toBeNull();
    const { data } = await anon.from("leads").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
    const info = (await anon.rpc("public_trial_info", { p_slug: "ridgeline" })).data as { school: { name: string } };
    expect(info.school.name).toBe("Ridgeline Taekwondo");
  });
});
