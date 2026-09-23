import path from "node:path";
import { expect, test } from "../support/fixtures";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { waitForLink } from "../support/mailpit";
import { sql, uniqueEmail } from "../../db/harness";

test.describe("@m5 onboarding wizard", () => {
  test("a fresh school completes every step in one run and goes live on the plan picked on the site", async ({ browser }) => {
    test.setTimeout(240_000);
    const owner = uniqueEmail("onboard-owner");
    const staffEmail = uniqueEmail("onboard-staff");
    const school = `Summit Karate ${Date.now().toString(36)}`;
    const desk = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

    // Sign up with a plan chosen on /pricing.
    await desk.goto("/signup?plan=studio");
    await expect(desk.getByText("Plan: Studio")).toBeVisible();
    await desk.getByLabel("School name").fill(school);
    await desk.getByLabel("Your name").fill("Sam Owner");
    await desk.getByLabel("Email").fill(owner);
    await desk.getByLabel("Password").fill("KoryoTest!2026");
    await desk.getByLabel("Timezone").selectOption("America/Denver");
    await desk.getByRole("button", { name: "Start 14-day trial" }).click();
    await desk.waitForURL(/\/desk\/onboarding$/);
    // New schools start with a default Taekwondo ladder, so "Programs" is already done.
    await expect(desk.getByText("1 of 8 steps done.")).toBeVisible();
    const [t] = await sql<{ id: string; plan: string }[]>`select t.id, t.settings ->> 'plan_choice' as plan from tenants t where t.name = ${school}`;
    expect(t?.plan).toBe("studio");
    const tid = t?.id ?? "";
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("link", { name: "Continue" }).click();

    // 1. Location
    await desk.waitForURL(/\/onboarding\/location$/);
    await desk.getByLabel("Street address").fill("120 Canyon Rd");
    await desk.getByLabel("City").fill("Boulder");
    await desk.getByLabel("State / region").fill("CO");
    await desk.getByLabel("Postal code").fill("80302");
    await desk.getByLabel("Phone").fill("303-555-0142");
    await desk.getByRole("button", { name: "Save location" }).click();
    await expect(desk.getByRole("status").filter({ hasText: "120 Canyon Rd, Boulder" })).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("link", { name: /^Next: Programs/ }).click();

    // 2. Programs from a preset
    await desk.getByRole("button", { name: "Add Karate" }).click();
    await expect(desk.getByRole("status").filter({ hasText: "2 programs, 21 ranks" })).toBeVisible();
    await desk.getByRole("link", { name: /^Next: Class schedule/ }).click();

    // 3. Schedule quick-add
    await desk.getByLabel("Class name").fill("Kids Beginners");
    await desk.getByLabel("Program").selectOption({ label: "Karate" });
    await desk.getByRole("button", { name: "Add class" }).click();
    await expect(desk.getByRole("list", { name: "Your classes" })).toContainText("Kids Beginners · MO,WE · 17:00");
    const [cls] = await sql<{ n: number }[]>`select count(*)::int as n from class_sessions where tenant_id = ${tid} and name = 'Kids Beginners'`;
    expect(cls?.n).toBeGreaterThan(0);
    await desk.getByRole("link", { name: /^Next: Students/ }).click();

    // 4. Students: add a family
    await desk.getByRole("link", { name: "Add a family" }).click();
    await desk.getByLabel("Household name", { exact: true }).fill("Nakamura family");
    const g = desk.getByRole("group", { name: "Guardian 1" });
    await g.getByLabel("First name", { exact: true }).fill("Aiko");
    await g.getByLabel("Last name", { exact: true }).fill("Nakamura");
    await g.getByLabel("Email", { exact: true }).fill(uniqueEmail("aiko"));
    const s1 = desk.getByRole("group", { name: "Student 1" });
    await s1.getByLabel("First name", { exact: true }).fill("Kenji");
    await s1.getByLabel("Last name", { exact: true }).fill("Nakamura");
    await s1.getByLabel("Date of birth", { exact: true }).fill("2016-03-02");
    await desk.getByRole("button", { name: "Save household" }).click();
    await desk.waitForURL(/\/desk\/households\//);
    await desk.goto("/desk/onboarding/students");
    await expect(desk.getByRole("status")).toHaveText("✓ 1 student");
    await desk.getByRole("link", { name: /^Next: Payments/ }).click();

    // 5. Payments: no Stripe keys in this environment → skipped, and labelled as such.
    await desk.getByRole("button", { name: "Skip for now" }).click();
    await expect(desk.getByRole("status").filter({ hasText: "Skipped — Not connected" })).toBeVisible();
    await desk.getByRole("link", { name: /^Next: Staff/ }).click();

    // 6. Staff invitation → real email → the instructor accepts and lands on the Mat.
    await desk.getByLabel("Name").fill("Riya Instructor");
    await desk.getByLabel("Email").fill(staffEmail);
    await desk.getByLabel("Role").selectOption("instructor");
    await desk.getByRole("button", { name: "Send invitation" }).click();
    await expect(desk.getByRole("list", { name: "Your team" })).toContainText("Riya InstructorInstructorinvited");
    const link = await waitForLink(staffEmail, /http[^"'\s]+\/auth\/v1\/verify[^"'\s]+/);
    const staff = await (await browser.newContext()).newPage();
    await staff.goto(link);
    await staff.waitForURL(/\/welcome/);
    await expect(staff.getByRole("list", { name: "Invitations" })).toContainText(`${school} invited you as Instructor`);
    await staff.getByRole("button", { name: "Accept" }).click();
    await staff.waitForURL(/\/mat/);
    await desk.reload();
    await expect(desk.getByRole("status").filter({ hasText: "2 active, 0 invited" })).toBeVisible();
    await desk.getByRole("link", { name: /^Next: Branding/ }).click();

    // 7. Branding: theme + logo
    await desk.getByText("Midnight", { exact: true }).click();
    await desk.getByLabel("Logo file").setInputFiles(path.join(process.cwd(), "tests/fixtures/images/logo.png"));
    await expect(desk.getByRole("img", { name: "Your logo" })).toBeVisible();
    await desk.getByRole("button", { name: "Save branding" }).click();
    await expect(desk.getByRole("status").filter({ hasText: "Logo uploaded" })).toBeVisible();
    await expect(desk.locator("html")).toHaveAttribute("data-theme", "midnight");
    await desk.getByRole("link", { name: /^Next: Go live/ }).click();

    // 8. Go live on the plan picked on the site (Studio: core + billing + home).
    await expect(desk.getByRole("radio", { name: /^Studio/ })).toBeChecked();
    await expectNoSeriousA11yViolations(desk);
    await desk.getByLabel(/Modules outside this plan will be switched off/).check();
    await desk.getByRole("button", { name: "Go live" }).click();
    await desk.waitForURL(/\/desk$/);
    const ents = await sql<{ module_key: string }[]>`select module_key from tenant_entitlements where tenant_id = ${tid} and (ends_at is null or ends_at > now()) order by 1`;
    expect(ents.map((e) => e.module_key)).toEqual(["billing", "core", "home"]);
    const [st] = await sql<{ status: string; plan: string }[]>`select t.status, s.plan_key as plan from tenants t join tenant_subscriptions s on s.tenant_id = t.id where t.id = ${tid}`;
    expect(st).toEqual({ status: "active", plan: "studio" });

    // Dashboard is populated from the real data; modules outside the plan are locked.
    await expect(desk.getByRole("link", { name: /Active students/ })).toContainText("1");
    await desk.goto("/desk/onboarding");
    await expect(desk.getByText("8 of 8 steps done.")).toBeVisible();
  });
});
