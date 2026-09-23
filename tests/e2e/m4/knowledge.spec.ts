import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const title = `Parking FAQ ${randomUUID().slice(0, 6)}`;

test.afterAll(async () => {
  await sql`delete from kb_documents where tenant_id = ${R} and title = ${title}`;
});

test.describe("@m4 knowledge base", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("add a document → indexed → the test search finds it; the nightly schedule digest is generated", async ({ page, request }) => {
    const desk = page;
    await desk.goto("/desk/settings/knowledge");
    await expect(desk.getByRole("list", { name: "Documents" }).getByRole("listitem", { name: "Refund policy" })).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    const form = desk.getByRole("form", { name: "Add a document" });
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Kind").selectOption("faq");
    await form.getByLabel("Text").fill("Where do I park? Parents can park in the rear lot behind the studio after 4pm. Please don't block the bakery's loading bay.");
    await form.getByRole("button", { name: "Add and index" }).click();
    await expect(desk.getByRole("list", { name: "Documents" }).getByRole("listitem", { name: title })).toContainText("1 chunk");
    const [doc] = await sql<{ chunk_count: number; indexed: boolean }[]>`select chunk_count, indexed_at is not null as indexed from kb_documents where tenant_id = ${R} and title = ${title}`;
    expect(doc).toEqual({ chunk_count: 1, indexed: true });

    await desk.getByLabel("Test question").fill("where can parents park the car");
    await desk.getByRole("button", { name: "Search", exact: true }).click();
    await expect(desk.getByRole("list", { name: "Search results" }).getByRole("listitem").first()).toContainText(title);

    const run = await request.post(`/api/jobs/kb_schedule_digest?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(run.ok(), await run.text()).toBe(true);
    await desk.reload();
    await expect(desk.getByRole("list", { name: "Documents" }).getByRole("listitem", { name: "Class schedule" })).toContainText("generated nightly");
  });

  test("families can't open the knowledge base settings", async ({ browser }) => {
    const parent = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    const res = await parent.goto("/desk/settings/knowledge");
    expect(res?.status()).not.toBe(200);
  });
});
