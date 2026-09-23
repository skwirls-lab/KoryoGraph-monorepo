import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runJob } from "@/server/jobs/runner";
import { sid } from "../../scripts/lib/ids";
import { sql } from "./harness";

const R = sid("tenant:ridgeline");
const person = randomUUID();
let leadId = "";
let auto = "";

beforeAll(async () => {
  await sql`insert into people (id, tenant_id, first_name, last_name, email, email_consent, type_flags, status) values (${person}, ${R}, 'Auto', 'Mation', ${`auto.${person.slice(0, 6)}@example.test`}, true, ${["lead"]}, 'lead')`;
  const [l] = await sql<{ id: string }[]>`insert into leads (tenant_id, person_id, stage_id) values (${R}, ${person}, (select id from pipeline_stages where tenant_id = ${R} and key = 'new')) returning id`;
  leadId = l?.id ?? "";
  const [a] = await sql<{ id: string }[]>`update automations set active = true where tenant_id = ${R} and template_key = 'trial_followup' returning id`;
  auto = a?.id ?? "";
});

afterAll(async () => {
  await sql`update automations set active = false where id = ${auto}`;
  await sql`delete from automation_runs where person_id = ${person}`;
  await sql`delete from people where id = ${person}`;
  await sql.end();
});

describe("event-triggered automations", () => {
  it("lead → trial_attended creates a run that waits a day, then sends and creates a task", async () => {
    await sql`update leads set stage_id = (select id from pipeline_stages where tenant_id = ${R} and key = 'trial_attended') where id = ${leadId}`;
    const [run] = await sql<{ id: string; status: string }[]>`select id, status from automation_runs where automation_id = ${auto} and person_id = ${person}`;
    expect(run?.status).toBe("pending");

    const now = new Date();
    await runJob("automations", { tenantId: R, now });
    const [waiting] = await sql<{ status: string; step: number }[]>`select status, step from automation_runs where id = ${run?.id ?? ""}`;
    expect(waiting).toEqual({ status: "waiting", step: 1 });
    expect(await sql`select id from communications where automation_run_id = ${run?.id ?? ""}`).toHaveLength(0);

    await runJob("automations", { tenantId: R, now: new Date(now.getTime() + 2 * 86_400_000) });
    const [done] = await sql<{ status: string; log: { action: string }[] }[]>`select status, log from automation_runs where id = ${run?.id ?? ""}`;
    expect(done?.status).toBe("done");
    expect(done?.log.map((l) => l.action)).toEqual(["wait", "send trial_followup", "create_task"]);
    const comms = await sql<{ channel: string; template_key: string }[]>`select channel, template_key from communications where automation_run_id = ${run?.id ?? ""}`;
    expect(comms).toEqual([{ channel: "email", template_key: "trial_followup" }]);
    const [task] = await sql<{ title: string; lead_id: string }[]>`select title, lead_id from tasks where related_id = ${run?.id ?? ""}`;
    expect(task).toEqual({ title: "Follow up with Auto Mation after their trial", lead_id: leadId });
  });

  it("inactive automations don't fire; conditions skip non-matching people", async () => {
    await sql`update automations set active = false where id = ${auto}`;
    await sql`update leads set stage_id = (select id from pipeline_stages where tenant_id = ${R} and key = 'contacted') where id = ${leadId}`;
    await sql`update leads set stage_id = (select id from pipeline_stages where tenant_id = ${R} and key = 'trial_attended') where id = ${leadId}`;
    const runs = await sql`select id from automation_runs where automation_id = ${auto} and person_id = ${person}`;
    expect(runs).toHaveLength(1); // same dedupe key, and the automation is off
    const [birthday] = await sql<{ id: string }[]>`update automations set active = true, conditions = '[{"field":"status","op":"in","value":["active"]}]' where tenant_id = ${R} and template_key = 'birthday' returning id`;
    const today = new Date();
    await sql`update people set dob = ${`2015-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`}, type_flags = ${["student"]} where id = ${person}`;
    await runJob("automations", { tenantId: R, now: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 16)) });
    const [b] = await sql<{ status: string }[]>`select status from automation_runs where automation_id = ${birthday?.id ?? ""} and person_id = ${person}`;
    expect(b?.status).toBe("skipped"); // status is 'lead', condition requires active
    await sql`update automations set active = false, conditions = '[{"field":"status","op":"in","value":["active","trial"]}]' where id = ${birthday?.id ?? ""}`;
  });
});
