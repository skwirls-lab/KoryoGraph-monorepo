import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
const ids: string[] = [];

afterAll(async () => {
  await sql`delete from communications where id = any(${ids}::uuid[])`;
  await sql.end();
});

describe("in-app notifications", () => {
  it("a family marks only its own notifications read, and can't see another family's", async () => {
    const rows = await sql<{ id: string }[]>`insert into communications (tenant_id, channel, person_id, status, subject, body_text) values
      (${R}, 'inapp', ${MAYA}, 'sent', 'For Coopers', 'x'), (${R}, 'inapp', ${RILEY}, 'sent', 'For Adams', 'y') returning id`;
    ids.push(...rows.map((r) => r.id));
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const seen = await asClaims(parent, (tx) => tx<{ subject: string }[]>`select subject from communications where id = any(${ids}::uuid[])`);
    expect(seen.map((r) => r.subject)).toEqual(["For Coopers"]);
    await asClaims(parent, (tx) => tx`select public.mark_notifications_read(${ids}::uuid[])`);
    const after = await sql<{ subject: string; read: boolean }[]>`select subject, read_at is not null as read from communications where id = any(${ids}::uuid[]) order by subject`;
    expect(after).toEqual([{ subject: "For Adams", read: false }, { subject: "For Coopers", read: true }]);
  });
});
