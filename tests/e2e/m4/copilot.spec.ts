import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const started = new Date();
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

test.afterAll(async () => {
  await sql`delete from approval_items where tenant_id = ${R} and kind = 'copilot_write' and created_at >= ${started}`;
  await sql`delete from ai_conversations where tenant_id = ${R} and created_at >= ${started}`;
  await sql`delete from message_threads where tenant_id = ${R} and subject = 'Question from the app assistant' and created_at >= ${started}`;
});

test.describe("@m4 copilot & home assistant", () => {
  test("⌘K ask → 'How many students are past due?' answers with the AR view's numbers and cites the report", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await page.goto("/desk");
    await page.getByRole("button", { name: "Search (Ctrl+K)" }).click();
    await page.getByRole("dialog").getByRole("combobox").fill("How many students are past due?");
    await page.getByRole("option", { name: /Ask Copilot/ }).click();
    await page.waitForURL(/\/desk\/copilot/);
    const answer = page.getByRole("list", { name: "Conversation" }).getByLabel("Copilot answer").last();
    await expect(answer).toBeVisible({ timeout: 30_000 });

    const [truth] = await sql<{ households: number; cents: number }[]>`select count(distinct household_id)::int as households, coalesce(sum(balance_cents), 0)::int as cents from v_ar_aging where tenant_id = ${R} and days_overdue > 0`;
    await expect(answer).toContainText(`${truth?.households ?? 0} families are past due`);
    await expect(answer).toContainText(money(truth?.cents ?? 0));
    await expect(answer).toContainText("Ran a report (past_due)");
    await expect(answer.getByRole("link", { name: /AR aging/ })).toHaveAttribute("href", "/desk/reports/ar-aging");
    await expectNoSeriousA11yViolations(page);

    // A write request only creates a draft in Approvals.
    await page.getByLabel("Ask the copilot").fill("Draft a friendly text to Maya Cooper's family about coming back to class");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByLabel("Copilot answer").last()).toContainText("nothing has been sent", { timeout: 30_000 });
    const [draft] = await sql`select status, person_id, payload -> 'messages' -> 0 ->> 'channel' as channel from approval_items where tenant_id = ${R} and kind = 'copilot_write' and created_at >= ${started}`;
    expect(draft).toEqual({ status: "pending", person_id: MAYA, channel: "sms" });

    // The conversation is saved and listed.
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Conversations" }).locator('[aria-current="page"]')).toContainText("past due");

    const mode = await page.getByText(/replays recorded dev examples|Answers from your school/).textContent();
    if (mode?.includes("recorded dev examples")) {
      await expect(page.getByLabel("Copilot answer").first()).toContainText("dev fixture");
      await page.getByLabel("Ask the copilot").fill("Which instructor has the best jokes?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      await expect(page.getByLabel("Copilot answer").last()).toContainText("isn't one of the recorded dev examples", { timeout: 30_000 });
    }
  });

  test("Home assistant answers from policy and refuses another family, offering the front desk", async ({ browser }) => {
    const home = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    await home.goto("/home/assistant");
    await expectNoSeriousA11yViolations(home);
    await home.getByLabel("Ask the assistant").fill("Can I get a refund for a testing fee?");
    await home.getByRole("button", { name: "Ask", exact: true }).click();
    const first = home.getByLabel("Assistant answer").last();
    await expect(first).toContainText("refundable up to 48 hours before the test", { timeout: 30_000 });
    await expect(first).toContainText("From: Refund policy");

    await home.getByLabel("Ask the assistant").fill("How is Riley Adams doing in class?");
    await home.getByRole("button", { name: "Ask", exact: true }).click();
    const refusal = home.getByLabel("Assistant answer").last();
    await expect(refusal).toContainText("can't share anything about other students", { timeout: 30_000 });
    await refusal.getByRole("button", { name: "Message the front desk" }).click();
    await home.waitForURL(/\/home\/messages\//);
    await expect(home.getByText("How is Riley Adams doing in class?")).toBeVisible();
  });
});
