import { randomUUID } from "node:crypto";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const subject = `Belt test question ${randomUUID().slice(0, 6)}`;

test.describe("@m1 communications", () => {
  test("parent writes → staff sees unread → replies → parent sees the reply; email notice is in the Outbox", async ({ browser }) => {
    const parentCtx = await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    const parent = await parentCtx.newPage();
    await parent.goto("/home/messages");
    const form = parent.getByRole("form", { name: "New message to the school" });
    await form.getByLabel("Subject").fill(subject);
    await form.getByLabel("Message").fill("Is Maya ready for Saturday's test?");
    await form.getByRole("button", { name: "Send to the school" }).click();
    await expect(parent).toHaveURL(/\/home\/messages\/[0-9a-f-]{36}$/);
    await expect(parent.getByRole("list", { name: "Messages" })).toContainText("Is Maya ready for Saturday's test?");
    const threadId = parent.url().split("/").pop() ?? "";

    const staffCtx = await browser.newContext({ storageState: authState("ridgeline", "frontdesk") });
    const staff = await staffCtx.newPage();
    await staff.goto("/desk");
    await expect(staff.getByRole("link", { name: /^Inbox/ }).getByLabel(/unread/)).toBeVisible();
    await staff.getByRole("link", { name: /^Inbox/ }).click();
    await staff.getByRole("link", { name: new RegExp(`Cooper family: ${subject}, 1 unread`) }).click();
    await expect(staff.getByRole("list", { name: "Messages" })).toContainText("Is Maya ready");
    await staff.getByLabel("Send reply").fill("Yes — she's signed off on everything. See you Saturday!");
    await staff.getByRole("button", { name: "Send reply" }).click();
    await expect(staff.getByRole("list", { name: "Messages" })).toContainText("See you Saturday!");

    await parent.goto("/home/messages");
    await expect(parent.getByRole("link", { name: `${subject}, 1 new` })).toBeVisible();
    await parent.getByRole("link", { name: `${subject}, 1 new` }).click();
    await expect(parent.getByRole("list", { name: "Messages" })).toContainText("See you Saturday!");

    const [c] = await sql<{ status: string; to_address: string }[]>`
      select status, to_address from public.communications where related_type = 'message_thread' and related_id = ${threadId} and channel = 'email'`;
    expect(c).toEqual({ status: "unsent_no_provider", to_address: "parent@ridgelinetkd.demo" });
    await staff.goto("/desk/outbox?status=unsent_no_provider");
    await expect(staff.getByRole("status").filter({ hasText: "Email provider" })).toContainText("not configured");
    await expect(staff.getByRole("table", { name: "Outbox" })).toContainText("thread message");
    await parentCtx.close();
    await staffCtx.close();
  });

  test("webhooks answer 503 until their provider is configured", async ({ request }) => {
    expect((await request.post("/api/webhooks/twilio", { form: { Body: "x" } })).status()).toBe(503);
    expect((await request.post("/api/webhooks/resend", { data: {} })).status()).toBe(503);
  });

  test.describe("templates", () => {
    test.use({ storageState: authState("ridgeline", "owner") });
    test("a customised template previews with sample data and rejects unknown merge fields", async ({ page }) => {
      await page.goto("/desk/settings/templates");
      const card = page.getByRole("region", { name: "class_cancelled sms" });
      await card.getByLabel("Message").fill("{{school_name}}: no {{class_name}} today {{bogus}}");
      await expect(card.getByLabel("Preview of class_cancelled sms")).toContainText("Ridgeline Taekwondo: no Youth Taekwondo today");
      await card.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Unknown merge field: {{bogus}}")).toBeVisible();
      await card.getByLabel("Message").fill("{{school_name}}: {{class_name}} is off today{{reason_suffix}}.");
      await card.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Template saved")).toBeVisible();
      await expect(card).toContainText("Customised");
      await card.getByRole("button", { name: "Reset to default" }).click();
      await expect(page.getByText("Back to the default")).toBeVisible();
    });
  });
});
