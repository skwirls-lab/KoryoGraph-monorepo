import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const COOPER = sid("household:ridgeline:cooper");
const ADAMS = sid("household:ridgeline:adams");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
const PLAN = sid("plan:ridgeline:monthly-unlimited");
const ids: Record<string, string> = {};

beforeAll(async () => {
  const mk = async (hh: string, person: string) => (await sql<{ id: string }[]>`insert into public.memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, notes)
    values (${R}, ${hh}, ${person}, ${PLAN}, 'active', current_date, 'wallet test') returning id`)[0]?.id ?? "";
  ids.cooperM = await mk(COOPER, MAYA);
  ids.adamsM = await mk(ADAMS, RILEY);
  const pm = async (hh: string, key: string, def: boolean) => (await sql<{ id: string }[]>`insert into public.payment_methods (tenant_id, household_id, stripe_payment_method_id, kind, brand, last4, is_default)
    values (${R}, ${hh}, ${`pm_wallet_${key}`}, 'card', 'visa', '4242', ${def}) returning id`)[0]?.id ?? "";
  ids.cooperPm = await pm(COOPER, "cooper", true);
  ids.cooperPm2 = await pm(COOPER, "cooper2", false);
  ids.adamsPm = await pm(ADAMS, "adams", true);
});

afterAll(async () => {
  await sql`delete from public.tasks where related_id = any(${[ids.cooperM ?? "", ids.adamsM ?? ""]})`;
  await sql`delete from public.memberships where notes = 'wallet test'`;
  await sql`delete from public.payment_methods where stripe_payment_method_id like 'pm_wallet_%'`;
  await sql.end();
});

describe("Home wallet RPCs", () => {
  it("a parent turns autopay on for their own membership (default card) but not another family's", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await asClaims(parent, (tx) => tx`select public.set_membership_autopay(${ids.cooperM ?? ""}, true)`);
    const [m] = await sql`select autopay, payment_method_id from public.memberships where id = ${ids.cooperM ?? ""}`;
    expect(m).toEqual({ autopay: true, payment_method_id: ids.cooperPm });
    await expect(asClaims(parent, (tx) => tx`select public.set_membership_autopay(${ids.adamsM ?? ""}, true)`)).rejects.toMatchObject({ code: "42501" });
    await expect(asClaims(parent, (tx) => tx`select public.set_membership_autopay(${ids.cooperM ?? ""}, true, ${ids.adamsPm ?? ""})`)).rejects.toMatchObject({ code: "22023" });
  });

  it("removing the autopay card turns autopay off and promotes another card to default", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await asClaims(parent, (tx) => tx`select public.mark_payment_method_detached(${ids.cooperPm ?? ""})`);
    const [m] = await sql`select autopay, payment_method_id from public.memberships where id = ${ids.cooperM ?? ""}`;
    expect(m).toEqual({ autopay: false, payment_method_id: null });
    const [pm2] = await sql`select is_default from public.payment_methods where id = ${ids.cooperPm2 ?? ""}`;
    expect(pm2?.is_default).toBe(true);
    await expect(asClaims(parent, (tx) => tx`select public.mark_payment_method_detached(${ids.adamsPm ?? ""})`)).rejects.toMatchObject({ code: "42501" });
  });

  it("a hold request creates a task staff can see; bad dates are refused", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const [row] = await asClaims(parent, (tx) => tx<{ id: string }[]>`select public.request_membership_hold(${ids.cooperM ?? ""}, current_date + 3, current_date + 20, 'Family trip') as id`);
    expect(row?.id).toBeTruthy();
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const tasks = await asClaims(owner, (tx) => tx<{ title: string; source: string; data: { kind: string } }[]>`select title, source, data from public.tasks where id = ${row?.id ?? ""}`);
    expect(tasks[0]).toMatchObject({ source: "request", data: { kind: "hold_request" } });
    expect(tasks[0]?.title).toMatch(/^Hold request: Maya Cooper/);
    await expect(asClaims(parent, (tx) => tx`select public.request_membership_hold(${ids.cooperM ?? ""}, current_date - 5, current_date + 3, '')`)).rejects.toMatchObject({ code: "22023" });
    await expect(asClaims(parent, (tx) => tx`select public.request_membership_hold(${ids.adamsM ?? ""}, current_date + 3, current_date + 20, '')`)).rejects.toMatchObject({ code: "42501" });
    const parentSees = await asClaims(parent, (tx) => tx`select id from public.tasks`);
    expect(parentSees).toHaveLength(0);
  });
});
