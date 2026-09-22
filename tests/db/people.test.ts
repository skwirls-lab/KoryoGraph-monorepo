import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

afterAll(async () => {
  await sql.end();
});

const R = sid("tenant:ridgeline");
const person = (k: string) => sid(`person:ridgeline:${k}`);
const COOPER = sid("household:ridgeline:cooper");
const ADAMS = sid("household:ridgeline:adams");

async function names(email: string): Promise<string[]> {
  const claims = await seededClaims(email);
  const rows = await asClaims(claims, (tx) => tx<{ first_name: string }[]>`select first_name from public.people order by first_name`);
  return rows.map((r) => r.first_name);
}

describe("people & households RLS", () => {
  it("a guardian sees their own household (both kids) and no other family", async () => {
    expect(await names("parent@ridgelinetkd.demo")).toEqual(["Leo", "Maya", "Morgan"]);
    const claims = await seededClaims("parent@ridgelinetkd.demo");
    const hh = await asClaims(claims, (tx) => tx<{ id: string }[]>`select id from public.households`);
    expect(hh.map((h) => h.id)).toEqual([COOPER]);
  });

  it("a student login sees their household only", async () => {
    expect(await names("student@ridgelinetkd.demo")).toEqual(["Jamie", "Riley"]);
  });

  it("staff with people.read see every person in their tenant only", async () => {
    const all = await names("frontdesk@ridgelinetkd.demo");
    expect(all).toEqual(expect.arrayContaining(["Jamie", "Leo", "Maya", "Morgan", "Riley"]));
    expect(all).not.toContain("Avery");
  });

  it("medical notes are readable with people.medical.read (instructor) but not by front desk or parents", async () => {
    await sql`insert into public.people_medical (tenant_id, person_id, medical_notes) values (${R}, ${person("maya-cooper")}, 'Asthma — inhaler in bag')
      on conflict (person_id) do update set medical_notes = excluded.medical_notes`;
    const read = async (email: string) =>
      (await asClaims(await seededClaims(email), (tx) => tx<{ n: number }[]>`select count(*)::int as n from public.people_medical`))[0]?.n;
    expect(await read("instructor@ridgelinetkd.demo")).toBe(1);
    expect(await read("frontdesk@ridgelinetkd.demo")).toBe(0);
    expect(await read("parent@ridgelinetkd.demo")).toBe(0);
  });

  it("parents cannot write people directly", async () => {
    const claims = await seededClaims("parent@ridgelinetkd.demo");
    const updated = await asClaims(claims, (tx) => tx`update public.people set last_name = 'X' where id = ${person("maya-cooper")} returning id`);
    expect(updated).toHaveLength(0);
  });

  it("a guardian can record consent for their own child from Home, not for another family's child", async () => {
    const claims = await seededClaims("parent@ridgelinetkd.demo");
    await asClaims(claims, (tx) => tx`
      insert into public.consents (tenant_id, person_id, guardian_person_id, kind, granted, method)
      values (${R}, ${person("maya-cooper")}, ${person("morgan-cooper")}, 'ai_processing', true, 'home')`);
    await expect(
      asClaims(claims, (tx) => tx`
        insert into public.consents (tenant_id, person_id, guardian_person_id, kind, granted, method)
        values (${R}, ${person("riley-adams")}, ${person("morgan-cooper")}, 'ai_processing', true, 'home')`),
    ).rejects.toMatchObject({ code: "42501" });
    const current = await asClaims(claims, (tx) => tx<{ kind: string; granted: boolean }[]>`
      select kind, granted from public.v_current_consents where person_id = ${person("maya-cooper")}`);
    expect(current).toContainEqual({ kind: "ai_processing", granted: true });
  });

  it("household PINs: guardian sets own household's PIN; hashes are never readable", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await asClaims(parent, (tx) => tx`select public.set_household_pin(${COOPER}, '4321')`);
    await expect(asClaims(parent, (tx) => tx`select public.set_household_pin(${ADAMS}, '1111')`)).rejects.toMatchObject({ code: "42501" });
    const visible = await asClaims(parent, (tx) => tx`select pin_hash from public.kiosk_pins`);
    expect(visible).toHaveLength(0);
    const [stored] = await sql<{ ok: boolean }[]>`select pin_hash = extensions.crypt('4321', pin_hash) as ok from public.kiosk_pins where household_id = ${COOPER}`;
    expect(stored?.ok).toBe(true);
  });
});
