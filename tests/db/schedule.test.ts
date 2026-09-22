import { addDays, localDate } from "@koryo/scheduling";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runJob } from "@/server/jobs/runner";
import { sid } from "../../scripts/lib/ids";
import { sql } from "./harness";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const MAYA = sid("person:ridgeline:maya-cooper");
let templateId = "";
let programId = "";
let dates: string[] = [];

function nextMonday(from: string): string {
  const d = new Date(`${from}T12:00:00Z`);
  const offset = (8 - d.getUTCDay()) % 7 || 7;
  return addDays(from, offset);
}

async function sessions() {
  return sql<{ occurrence_date: string; status: string; starts_at: Date; updated_at: Date; id: string }[]>`
    select to_char(occurrence_date, 'YYYY-MM-DD') as occurrence_date, status, starts_at, updated_at, id
    from public.class_sessions where template_id = ${templateId} order by occurrence_date`;
}

beforeAll(async () => {
  const start = nextMonday(localDate(new Date(), "America/New_York"));
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, 'Schedule Spec', ${`schedule-spec-${Date.now()}`}) returning id`;
  programId = p?.id ?? "";
  const [t] = await sql<{ id: string }[]>`
    insert into public.class_templates (tenant_id, location_id, name, program_ids, rrule, start_date, start_time, until_date, duration_min, capacity)
    values (${R}, ${LOC}, 'Youth TKD (spec)', ${[programId]}, 'FREQ=WEEKLY;BYDAY=MO,WE', ${start}, '17:00', ${addDays(start, 27)}, 60, 20)
    returning id`;
  templateId = t?.id ?? "";
});

afterAll(async () => {
  await sql`delete from public.class_templates where id = ${templateId}`;
  await sql`delete from public.class_sessions where template_id is null and name = 'Youth TKD (spec)'`;
  await sql`delete from public.holidays where tenant_id = ${R} and name = 'Spec holiday'`;
  await sql`delete from public.programs where id = ${programId}`;
  await sql.end();
});

describe("materialize_sessions", () => {
  it("weekly Mon/Wed 17:00 for 4 weeks → 8 sessions at 17:00 local", async () => {
    const r = await runJob("materialize_sessions", { tenantId: R });
    expect(r.status).toBe("ok");
    const rows = await sessions();
    expect(rows).toHaveLength(8);
    dates = rows.map((s) => s.occurrence_date);
    for (const s of rows) {
      expect(s.status).toBe("scheduled");
      const local = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(s.starts_at);
      expect(local).toBe("17:00");
    }
    const [run] = await sql<{ status: string }[]>`select status from public.job_runs where id = ${r.runId}`;
    expect(run?.status).toBe("ok");
  });

  it("an exception cancels one; a holiday removes one", async () => {
    await sql`insert into public.schedule_exceptions (tenant_id, template_id, date, kind, reason) values (${R}, ${templateId}, ${dates[1] ?? ""}, 'cancel', 'Tournament')`;
    await sql`insert into public.holidays (tenant_id, date, name) values (${R}, ${dates[2] ?? ""}, 'Spec holiday')`;
    await runJob("materialize_sessions", { tenantId: R });
    const rows = await sessions();
    expect(rows).toHaveLength(7);
    expect(rows.filter((s) => s.status === "cancelled").map((s) => s.occurrence_date)).toEqual([dates[1]]);
    expect(rows.map((s) => s.occurrence_date)).not.toContain(dates[2]);
  });

  it("a re-run changes nothing", async () => {
    const before = await sessions();
    const r = await runJob("materialize_sessions", { tenantId: R });
    expect(r.stats).toMatchObject({ inserted: 0, updated: 0, deleted: 0, cancelled: 0 });
    expect(await sessions()).toEqual(before);
  });

  it("a modify exception moves the session in place", async () => {
    await sql`insert into public.schedule_exceptions (tenant_id, template_id, date, kind, overrides) values (${R}, ${templateId}, ${dates[3] ?? ""}, 'modify', ${sql.json({ startTime: "18:30" })})`;
    const beforeIds = (await sessions()).map((s) => s.id);
    const r = await runJob("materialize_sessions", { tenantId: R });
    expect(r.stats).toMatchObject({ inserted: 0, updated: 1 });
    const rows = await sessions();
    expect(rows.map((s) => s.id)).toEqual(beforeIds);
    const moved = rows.find((s) => s.occurrence_date === dates[3]);
    const local = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(moved?.starts_at);
    expect(local).toBe("18:30");
  });
});

describe("attendance → classes_since_promotion", () => {
  it("counts attendance in the enrollment's program since the last promotion", async () => {
    const [e] = await sql<{ id: string }[]>`
      insert into public.enrollments (tenant_id, person_id, program_id, started_at) values (${R}, ${MAYA}, ${programId}, current_date - 1) returning id`;
    const rows = await sessions();
    const s1 = rows[0]?.id ?? "";
    const s2 = rows[3]?.id ?? "";
    const count = async () => (await sql<{ n: number }[]>`select classes_since_promotion as n from public.enrollments where id = ${e?.id ?? ""}`)[0]?.n;
    await sql`insert into public.attendance (tenant_id, session_id, person_id, source) values (${R}, ${s1}, ${MAYA}, 'desk'), (${R}, ${s2}, ${MAYA}, 'mat')`;
    expect(await count()).toBe(2);
    await sql`delete from public.attendance where session_id = ${s2} and person_id = ${MAYA}`;
    expect(await count()).toBe(1);
    // A promotion after the sessions resets the window.
    await sql`update public.enrollments set last_promoted_at = ${new Date(Date.now() + 400 * 86400_000)} where id = ${e?.id ?? ""}`;
    expect(await count()).toBe(0);
  });
});
