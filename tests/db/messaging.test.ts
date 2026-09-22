import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
let cooperThread = "";
let adamsThread = "";

beforeAll(async () => {
  const [a] = await sql<{ id: string }[]>`insert into public.message_threads (tenant_id, household_id, subject) values (${R}, ${sid("household:ridgeline:cooper")}, 'db test') returning id`;
  const [b] = await sql<{ id: string }[]>`insert into public.message_threads (tenant_id, household_id, subject) values (${R}, ${sid("household:ridgeline:adams")}, 'db test') returning id`;
  cooperThread = a?.id ?? "";
  adamsThread = b?.id ?? "";
});

afterAll(async () => {
  await sql`delete from public.message_threads where id in (${cooperThread}, ${adamsThread})`;
  await sql.end();
});

describe("messaging RLS", () => {
  it("a guardian can post to their own household's thread as themselves, and counters update", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const uid = parent.sub as string;
    await asClaims(parent, (tx) => tx`insert into public.thread_messages (tenant_id, thread_id, sender_user_id, from_staff, body) values (${R}, ${cooperThread}, ${uid}, false, 'hello')`);
    const [t] = await sql<{ unread_staff: number }[]>`select unread_staff from public.message_threads where id = ${cooperThread}`;
    expect(t?.unread_staff).toBe(1);
  });

  it("a guardian cannot post as staff or into another family's thread", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const uid = parent.sub as string;
    await expect(asClaims(parent, (tx) => tx`insert into public.thread_messages (tenant_id, thread_id, sender_user_id, from_staff, body) values (${R}, ${cooperThread}, ${uid}, true, 'fake staff')`)).rejects.toMatchObject({ code: "42501" });
    await expect(asClaims(parent, (tx) => tx`insert into public.thread_messages (tenant_id, thread_id, sender_user_id, from_staff, body) values (${R}, ${adamsThread}, ${uid}, false, 'wrong family')`)).rejects.toMatchObject({ code: "42501" });
    const visible = await asClaims(parent, (tx) => tx<{ id: string }[]>`select id from public.message_threads where id in (${cooperThread}, ${adamsThread})`);
    expect(visible.map((v) => v.id)).toEqual([cooperThread]);
  });

  it("a guardian cannot read the staff communications log except in-app messages for their family", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const rows = await asClaims(parent, (tx) => tx<{ channel: string }[]>`select channel from public.communications`);
    expect(rows.every((r) => r.channel === "inapp")).toBe(true);
  });

  it("record_communication refuses Home users for staff-only templates", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.record_communication(${sql.json({ channel: "email", template_key: "class_broadcast", status: "sent", body_text: "spam" })})`)).rejects.toMatchObject({ code: "42501" });
  });
});
