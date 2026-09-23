import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@koryo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
const camp = randomUUID();
const party = randomUUID();
const waiver = randomUUID();
const days = [randomUUID(), randomUUID(), randomUUID()];

beforeAll(async () => {
  await sql`insert into document_templates (id, tenant_id, kind, name, body) values (${waiver}, ${R}, 'waiver', ${`DB camp waiver ${waiver.slice(0, 6)}`}, 'Camp waiver body')`;
  await sql`insert into events (id, tenant_id, kind, name, starts_at, ends_at, capacity, waiver_template_ids, pricing)
            values (${camp}, ${R}, 'camp', 'DB camp', now() + interval '7 days', now() + interval '9 days', 1, ${[waiver]},
                    ${sql.json([{ label: "Day", price_cents: 4000, per: "day" }, { label: "Week", price_cents: 15000, per: "week" }])})`;
  for (const [i, d] of days.entries()) {
    await sql`insert into event_days (id, tenant_id, event_id, date, starts_at, ends_at)
              values (${d}, ${R}, ${camp}, (now() + ${`${7 + i} days`}::interval)::date, now() + ${`${7 + i} days`}::interval, now() + ${`${7 + i} days 6 hours`}::interval)`;
  }
  await sql`insert into events (id, tenant_id, kind, name, starts_at, ends_at, pricing, deposit_cents, host_household_id)
            values (${party}, ${R}, 'party', 'DB party', now() + interval '3 days', now() + interval '3 days 2 hours', '[]'::jsonb, 10000,
                    (select household_id from household_members where person_id = ${MAYA} limit 1))`;
});

afterAll(async () => {
  await sql`delete from invoices where id in (select invoice_id from event_registrations where event_id = ${camp})`;
  await sql`delete from invoices where id in (select deposit_invoice_id from events where id = ${party})`;
  await sql`delete from events where id in (${camp}, ${party})`;
  await sql`delete from signatures where template_id = ${waiver}`;
  await sql`delete from document_templates where id = ${waiver}`;
  await sql.end();
});

describe("event registration", () => {
  it("requires the waiver, prices the chosen days, invoices, and marks paid when the invoice is paid", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const reg = (p: string, d: string[]) => asClaims(parent, (tx) => tx<{ r: { registration_id: string; invoice_id: string; price_cents: number } }[]>`select public.register_for_event(${camp}, ${p}, 'Day', ${d}, true) as r`);
    await expect(reg(RILEY, days.slice(0, 2))).rejects.toMatchObject({ code: "42501" });
    await expect(reg(MAYA, days.slice(0, 2))).rejects.toThrow(/sign the required waiver/);
    await sql`insert into signatures (tenant_id, template_id, person_id, typed_name, method) values (${R}, ${waiver}, ${MAYA}, 'Parent Cooper', 'home')`;
    const [row] = await reg(MAYA, days.slice(0, 2));
    expect(row?.r.price_cents).toBe(8000);
    const [inv] = await sql`select source, total_cents from invoices where id = ${row?.r.invoice_id ?? ""}`;
    expect(inv).toEqual({ source: "event", total_cents: 8000 });
    await sql`insert into payments (id, tenant_id, household_id, invoice_id, amount_cents, method, status) select ${randomUUID()}, ${R}, household_id, id, 8000, 'cash', 'succeeded' from invoices where id = ${row?.r.invoice_id ?? ""}`;
    await sql`insert into payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) select ${R}, p.id, p.invoice_id, 8000 from payments p where p.invoice_id = ${row?.r.invoice_id ?? ""}`;
    const [r] = await sql`select status from event_registrations where id = ${row?.r.registration_id ?? ""}`;
    expect(r?.status).toBe("paid");
  });

  it("enforces capacity per day", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await sql`insert into signatures (tenant_id, template_id, person_id, typed_name, method) values (${R}, ${waiver}, ${RILEY}, 'Parent Adams', 'desk')`;
    // Capacity 1: days 1–2 are taken by Maya; day 3 is free.
    await expect(asClaims(owner, (tx) => tx`select public.register_for_event(${camp}, ${RILEY}, 'Day', ${[days[1] ?? ""]}, true)`)).rejects.toThrow(/full/);
    const [ok] = await asClaims(owner, (tx) => tx<{ r: { price_cents: number } }[]>`select public.register_for_event(${camp}, ${RILEY}, 'Day', ${[days[2] ?? ""]}, true) as r`);
    expect(ok?.r.price_cents).toBe(4000);
  });

  it("check-out needs a pickup name and signature; only registered days", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const check = (d: string, action: string, name: string | null, sig: string | null) =>
      asClaims(owner, (tx) => tx`select public.event_check(${d}, ${MAYA}, ${action}, ${name}, ${sig})`);
    await expect(check(days[2] ?? "", "in", null, null)).rejects.toThrow(/not registered/);
    await check(days[0] ?? "", "in", null, null);
    await expect(check(days[0] ?? "", "out", "Grandma", null)).rejects.toThrow(/signature/);
    await check(days[0] ?? "", "out", "Grandma Cooper", `${R}/events/${camp}/sig.png`);
    const [c] = await sql`select pickup_person_name, signature_path, out_at is not null as out from event_checkins where event_day_id = ${days[0] ?? ""} and person_id = ${MAYA}`;
    expect(c).toMatchObject({ pickup_person_name: "Grandma Cooper", out: true });
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.event_check(${days[0] ?? ""}, ${MAYA}, 'in', null, null)`)).rejects.toMatchObject({ code: "42501" });
  });

  it("a party deposit invoices the host family once", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const [a] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.create_party_deposit(${party}) as id`);
    const [b] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.create_party_deposit(${party}) as id`);
    expect(b?.id).toBe(a?.id);
    const [inv] = await sql`select source, total_cents from invoices where id = ${a?.id ?? ""}`;
    expect(inv).toEqual({ source: "event", total_cents: 10000 });
  });

  it("party guests sign a waiver through the link without logging in; anon can't read event tables", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.party_guest_link(${party})`)).rejects.toMatchObject({ code: "42501" });
    const [{ token } = { token: "" }] = await asClaims(owner, (tx) => tx<{ token: string }[]>`select public.party_guest_link(${party}) as token`);
    const info = await anon.rpc("guest_waiver_info", { p_token: token });
    expect(info.error).toBeNull();
    expect((info.data as { event: string }).event).toBe("DB party");
    const bad = await anon.rpc("sign_guest_waiver", { p_token: "nope", p_guest_name: "Kid", p_guest_dob: "2018-01-01", p_guardian_name: "Mom", p_guardian_phone: "", p_typed_signature: "Mom", p_ip: "" });
    expect(bad.error?.message).toMatch(/no longer valid/);
    const ok = await anon.rpc("sign_guest_waiver", { p_token: token, p_guest_name: "Guest Kid", p_guest_dob: "2018-01-01", p_guardian_name: "Guest Parent", p_guardian_phone: "555-0100", p_typed_signature: "Guest Parent", p_ip: "127.0.0.1" });
    expect(ok.error).toBeNull();
    const [n] = await sql`select count(*)::int as n from event_guest_waivers where event_id = ${party}`;
    expect(n?.n).toBe(1);
    const read = await anon.from("event_guest_waivers").select("id");
    expect(read.data ?? []).toHaveLength(0);
  });
});
