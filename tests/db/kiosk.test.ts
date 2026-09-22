import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { sql } from "./harness";

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
const R = sid("tenant:ridgeline");
const H = sid("tenant:harbor");
const token = randomBytes(32).toString("base64url");
let deviceId = "";

beforeAll(async () => {
  const [d] = await sql<{ id: string }[]>`
    insert into public.kiosk_devices (tenant_id, location_id, name, token_hash)
    values (${H}, ${sid("location:harbor:main")}, 'db-test kiosk', ${createHash("sha256").update(token).digest("hex")}) returning id`;
  deviceId = d?.id ?? "";
});

afterAll(async () => {
  await sql`delete from public.kiosk_devices where id = ${deviceId}`;
  await sql.end();
});

describe("kiosk RPCs", () => {
  it("reject unknown tokens", async () => {
    const { error } = await anon.rpc("kiosk_search", { p_token: randomBytes(32).toString("base64url"), p_q: "ma" });
    expect(error?.message).toMatch(/kiosk not paired/);
  });

  it("only search the device's own tenant", async () => {
    const { data, error } = await anon.rpc("kiosk_search", { p_token: token, p_q: "a" + "v" });
    expect(error).toBeNull();
    expect((data ?? []).map((r: { display_name: string }) => r.display_name)).toEqual(["Avery Quinn"]);
    const { data: other } = await anon.rpc("kiosk_search", { p_token: token, p_q: "maya" });
    expect(other).toEqual([]);
  });

  it("cannot open another tenant's family or check them in", async () => {
    const { error: famErr } = await anon.rpc("kiosk_family", { p_token: token, p_person_id: sid("person:ridgeline:maya-cooper") });
    expect(famErr?.message).toMatch(/not in a household/);
    const { error } = await anon.rpc("kiosk_check_in_confirmed", {
      p_token: token, p_household_id: sid("household:ridgeline:cooper"), p_items: [{ person_id: sid("person:ridgeline:maya-cooper"), session_id: sid("x") }],
    });
    expect(error).not.toBeNull();
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from public.attendance where tenant_id = ${R} and source = 'kiosk' and person_id = ${sid("person:ridgeline:maya-cooper")} and checked_in_at > now() - interval '5 seconds'`;
    expect(n?.n).toBe(0);
  });

  it("refuse revoked devices", async () => {
    await sql`update public.kiosk_devices set revoked_at = now() where id = ${deviceId}`;
    const { error } = await anon.rpc("kiosk_info", { p_token: token });
    expect(error?.message).toMatch(/kiosk not paired/);
  });
});
