import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const tag = randomUUID().slice(0, 6);
const ids = [randomUUID(), randomUUID()];
const titles = [`Check in with Maya ${tag}`, `Second draft ${tag}`];

test.beforeAll(async () => {
  for (const [i, id] of ids.entries()) {
    await sql`insert into approval_items (id, tenant_id, kind, title, preview, payload, person_id)
      values (${id}, ${R}, 'drift_outreach', ${titles[i] ?? ""}, 'Attendance fell from 3 to 1 class a week over the last month.',
              ${sql.json({ person_id: MAYA, messages: [{ channel: "email", subject: "We miss Maya!", body: "Hi {{first_name}}, we haven't seen Maya lately." }] })}, ${MAYA})`;
  }
});

test.afterAll(async () => {
  await sql`delete from communications where related_type = 'approval_item' and related_id = any(${ids}::uuid[])`;
  await sql`delete from approval_items where id = any(${ids}::uuid[])`;
});

test.describe("@m4 approvals", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("approve an edited draft → message queued; reject with feedback → stored", async ({ page }) => {
    await page.goto("/desk");
    await expect(page.getByRole("link", { name: /Approvals, \d+ waiting/ })).toBeVisible();
    await page.getByRole("link", { name: /Approvals, \d+ waiting/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Approvals" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const first = page.getByRole("article", { name: titles[0] });
    await first.getByRole("textbox", { name: "Email body" }).fill("Hi {{first_name}}, Maya's spot on Tuesday is waiting for her — hope to see you soon!");
    await first.getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByText(/Approved — \d+ messages? queued/)).toBeVisible();
    const msgs = await sql<{ body_text: string; status: string }[]>`select body_text, status from communications where related_type = 'approval_item' and related_id = ${ids[0] ?? ""}`;
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.every((m) => m.body_text.includes("spot on Tuesday") && !m.body_text.includes("{{first_name}}"))).toBe(true);
    expect(msgs.every((m) => ["queued", "no_address"].includes(m.status))).toBe(true);

    const second = page.getByRole("article", { name: titles[1] });
    await second.getByRole("button", { name: "Reject…" }).click();
    await second.getByLabel("Why reject?").fill("Family already told us they're travelling");
    await second.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByRole("list", { name: "Recently decided" })).toContainText("Family already told us they're travelling");
    const [r] = await sql`select status, feedback from approval_items where id = ${ids[1] ?? ""}`;
    expect(r).toEqual({ status: "rejected", feedback: "Family already told us they're travelling" });
    const [a] = await sql`select status, execution_result ->> 'ok' as ok from approval_items where id = ${ids[0] ?? ""}`;
    expect(a).toEqual({ status: "approved", ok: "true" });
  });
});
