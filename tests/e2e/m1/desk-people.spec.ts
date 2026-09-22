import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "../support/fixtures";
import { authState } from "../support/auth";

const surname = `Zephyr${randomUUID().slice(0, 6)}`;

test.describe("@m1 desk people", () => {
  test.describe.configure({ mode: "serial" });

  test.describe("as owner", () => {
    test.use({ storageState: authState("ridgeline", "owner") });

    test("create a household with a guardian and two students, then find it", async ({ page }) => {
      await page.goto("/desk/people/new");
      await page.getByLabel("Household name", { exact: true }).fill(`${surname} family`);

      const guardian = page.getByRole("group", { name: "Guardian 1" });
      await guardian.getByLabel("First name", { exact: true }).fill("Harper");
      await guardian.getByLabel("Last name", { exact: true }).fill(surname);
      await guardian.getByLabel("Email", { exact: true }).fill(`harper.${surname.toLowerCase()}@example.test`);

      const s1 = page.getByRole("group", { name: "Student 1" });
      await s1.getByLabel("First name", { exact: true }).fill("Juniper");
      await s1.getByLabel("Last name", { exact: true }).fill(surname);
      await s1.getByLabel("Date of birth", { exact: true }).fill("2017-05-04");
      await s1.getByLabel("Allergies", { exact: true }).fill("peanuts");
      await s1.getByLabel("AI processing of class audio/video").check();

      await page.getByRole("button", { name: "Add student" }).click();
      const s2 = page.getByRole("group", { name: "Student 2" });
      await s2.getByLabel("First name", { exact: true }).fill("Rowan");
      await s2.getByLabel("Last name", { exact: true }).fill(surname);
      await s2.getByLabel("Date of birth", { exact: true }).fill("2014-11-20");

      await page.getByRole("button", { name: "Save household" }).click();
      await expect(page).toHaveURL(/\/desk\/households\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("heading", { level: 1, name: `${surname} family` })).toBeVisible();
      const members = page.getByRole("region", { name: "Members" }).getByRole("listitem");
      await expect(members).toHaveCount(3);
      await expect(members.first()).toContainText("primary payer");

      // The list finds them by a partial name, search-as-you-type.
      await page.goto("/desk/people");
      await page.getByRole("searchbox", { name: "Search people" }).fill(surname.slice(0, 9).toLowerCase());
      await expect(page).toHaveURL(new RegExp(`q=${surname.slice(0, 9).toLowerCase()}`));
      const rows = page.getByRole("table", { name: "People" }).getByRole("row");
      await expect(rows).toHaveCount(4); // header + 3
      await expect(page.getByRole("link", { name: `Juniper ${surname}` })).toBeVisible();

      // Consent recorded at the desk shows on the profile.
      await page.getByRole("link", { name: `Juniper ${surname}` }).click();
      await expect(page.getByRole("switch", { name: "AI processing of class audio/video" })).toBeChecked();
      await expect(page.getByRole("heading", { name: "Medical notes" })).toBeVisible();
    });

    test("CSV export contains exactly the filtered rows", async ({ page }) => {
      await page.goto(`/desk/people?q=${surname.toLowerCase()}`);
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("of 3");
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: "Export CSV" }).click();
      const file = await (await download).path();
      const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);
      expect(lines[0]).toContain("first_name");
      expect(lines).toHaveLength(1 + 3);
      expect(lines.slice(1).every((l) => l.includes(surname))).toBe(true);
    });

    test("bulk tag the selection", async ({ page }) => {
      await page.goto(`/desk/people?q=${surname.toLowerCase()}`);
      await page.getByRole("checkbox", { name: "Select all rows" }).check();
      await page.getByRole("button", { name: /Tag 3 selected/ }).click();
      await page.getByLabel("Tag", { exact: true }).fill("Summer Camp");
      await page.getByRole("button", { name: "Add tag" }).click();
      await expect(page.getByText("Tagged 3 people “summer camp”")).toBeVisible();
      await page.goto(`/desk/people?tag=summer+camp&q=${surname.toLowerCase()}`);
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("of 3");
    });
  });

  test.describe("as front desk", () => {
    test.use({ storageState: authState("ridgeline", "frontdesk") });
    test("medical notes are hidden without people.medical.read", async ({ page }) => {
      await page.goto(`/desk/people?q=juniper+${surname.toLowerCase()}`);
      await page.getByRole("link", { name: `Juniper ${surname}` }).click();
      await expect(page.getByRole("heading", { level: 1, name: `Juniper ${surname}` })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Safety" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Medical notes" })).toHaveCount(0);
    });
  });
});
