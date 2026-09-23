import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const VARIANT = sid("variant:ridgeline:white-belt:5");
const onHand = async () => (await sql<{ on_hand: number }[]>`select on_hand from public.inventory_levels where variant_id = ${VARIANT} and location_id = ${LOC}`)[0]?.on_hand ?? 0;
const movementIds: string[] = [];

afterAll(async () => {
  // Undo this file's movements so the stock returns to where it started.
  const [sum] = await sql<{ s: number }[]>`select coalesce(sum(delta), 0)::int as s from public.inventory_movements where id = any(${movementIds})`;
  await sql`delete from public.inventory_movements where id = any(${movementIds})`;
  await sql`update public.inventory_levels set on_hand = on_hand - ${sum?.s ?? 0} where variant_id = ${VARIANT} and location_id = ${LOC}`;
  await sql.end();
});

describe("inventory ledger", () => {
  it("adjust_inventory writes a movement and the level follows", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const before = await onHand();
    const [a] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.adjust_inventory(${VARIANT}, ${LOC}, 5, 'receive', 'Delivery 42') as id`);
    const [b] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.adjust_inventory(${VARIANT}, ${LOC}, -2, 'adjust', 'Damaged') as id`);
    movementIds.push(a?.id ?? "", b?.id ?? "");
    expect(await onHand()).toBe(before + 3);
    await expect(asClaims(owner, (tx) => tx`select public.adjust_inventory(${VARIANT}, ${LOC}, -1, 'adjust', '')`)).rejects.toMatchObject({ code: "22023" });
    await expect(asClaims(owner, (tx) => tx`select public.adjust_inventory(${VARIANT}, ${LOC}, 1, 'sale', 'x')`)).rejects.toMatchObject({ code: "22023" });
  });

  it("nobody writes movements or levels directly; front desk (no inventory.manage) can't adjust", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(owner, (tx) => tx`insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason) values (${R}, ${VARIANT}, ${LOC}, 100, 'receive')`)).rejects.toMatchObject({ code: "42501" });
    await expect(asClaims(owner, (tx) => tx`update public.inventory_levels set on_hand = 999 where variant_id = ${VARIANT}`)).resolves.toHaveLength(0);
    const front = await seededClaims("frontdesk@ridgelinetkd.demo");
    const perms = (front.app_metadata as { permissions: string[] }).permissions;
    if (!perms.includes("inventory.manage")) {
      await expect(asClaims(front, (tx) => tx`select public.adjust_inventory(${VARIANT}, ${LOC}, 1, 'receive', null)`)).rejects.toMatchObject({ code: "42501" });
    }
    const harbor = await seededClaims("owner@harborbjj.demo");
    expect(await asClaims(harbor, (tx) => tx`select variant_id from public.v_inventory`)).toHaveLength(0);
  });

  it("delivering an enrollment kit takes it out of stock; undoing puts it back", async () => {
    const before = await onHand();
    const [f] = await sql<{ id: string }[]>`insert into public.gear_fulfilments (tenant_id, household_id, person_id, variant_ids, sizes)
      values (${R}, ${sid("household:ridgeline:cooper")}, ${sid("person:ridgeline:maya-cooper")}, ${[VARIANT]}, '{"White belt":"5"}') returning id`;
    await sql`update public.gear_fulfilments set status = 'delivered' where id = ${f?.id ?? ""}`;
    expect(await onHand()).toBe(before - 1);
    await sql`update public.gear_fulfilments set status = 'pending' where id = ${f?.id ?? ""}`;
    expect(await onHand()).toBe(before);
    const ms = await sql<{ id: string }[]>`select id from public.inventory_movements where ref_id = ${f?.id ?? ""}`;
    movementIds.push(...ms.map((m) => m.id));
    await sql`delete from public.gear_fulfilments where id = ${f?.id ?? ""}`;
  });
});
