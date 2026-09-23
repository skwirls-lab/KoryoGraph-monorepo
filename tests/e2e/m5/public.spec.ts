import { randomUUID } from "node:crypto";
import { sql } from "../../db/harness";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const tag = randomUUID().slice(0, 8);
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

test.afterAll(async () => {
  await sql`delete from contact_messages where email = ${`visitor.${tag}@example.test`}`;
});

test.describe("@m5 public site", () => {
  test("crawler: every internal link on the public site resolves (no 404s)", async ({ page, request }) => {
    test.setTimeout(120_000);
    const seen = new Set<string>();
    const queue = ["/"];
    const broken: string[] = [];
    while (queue.length) {
      const path = queue.shift() as string;
      if (seen.has(path)) continue;
      seen.add(path);
      const res = await request.get(path, { maxRedirects: 5 });
      if (res.status() >= 400) { broken.push(`${path} → ${res.status()}`); continue; }
      if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
      await page.goto(path);
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
      for (const h of hrefs) {
        if (!h.startsWith("/") || h.startsWith("//")) continue;
        const clean = h.split("#")[0]?.split("?")[0] ?? "";
        // Stay on the marketing site: follow links into it, but only probe (not crawl) app entry points.
        if (["/desk", "/mat", "/home", "/kiosk", "/auth"].some((p) => clean === p || clean.startsWith(`${p}/`))) continue;
        if (clean && !seen.has(clean)) queue.push(clean);
      }
    }
    expect(broken).toEqual([]);
    for (const p of ["/", "/features", "/pricing", "/contact", "/privacy", "/terms", "/signup", "/login"]) expect(seen.has(p), p).toBe(true);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/pricing</loc>");
  });

  test("pricing: plan prices and the module picker total match the plans/modules tables", async ({ page }) => {
    const plans = await sql<{ key: string; monthly_cents: number; annual_cents: number }[]>`select key, monthly_cents, annual_cents from plans where public order by sort`;
    const modules = await sql<{ key: string; name: string; required: boolean; monthly_cents: number; annual_cents: number }[]>`select key, name, required, monthly_cents, annual_cents from modules order by sort`;
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    for (const p of plans) await expect(page.getByTestId(`plan-price-${p.key}`)).toHaveText(dollars(p.monthly_cents));
    await expectNoSeriousA11yViolations(page);

    // Pick exactly Retail + Grow (+ required Core), monthly then annual.
    const want = ["retail", "grow"];
    for (const m of modules) {
      if (m.required) continue;
      const box = page.getByRole("checkbox", { name: new RegExp(`^${m.name}`) });
      if (want.includes(m.key)) await box.check(); else await box.uncheck();
    }
    const sum = (field: "monthly_cents" | "annual_cents") => modules.filter((m) => m.required || want.includes(m.key)).reduce((a, m) => a + m[field], 0);
    await expect(page.getByTestId("pricing-total")).toContainText(dollars(sum("monthly_cents")));
    await page.getByText("Annual (2 months free)").click();
    await expect(page.getByTestId("pricing-total")).toContainText(dollars(sum("annual_cents")));
    for (const p of plans) await expect(page.getByTestId(`plan-price-${p.key}`)).toHaveText(dollars(p.annual_cents));

    // Choosing a plan carries through to sign-up.
    await page.getByRole("listitem", { name: "Academy", exact: true }).getByRole("link", { name: "Start with Academy" }).click();
    await page.waitForURL(/\/signup\?plan=academy/);
    await expect(page.getByText("Plan: Academy")).toBeVisible();
  });

  test("contact form lands in the platform inbox", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name").fill("Casey Visitor");
    await page.getByLabel("Email").fill(`visitor.${tag}@example.test`);
    await page.getByLabel("School (optional)").fill("Summit Karate");
    await page.getByLabel("What's it about?").selectOption("demo");
    await page.getByLabel("Message").fill("We have 180 students and would love a walkthrough next week.");
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("Thanks, Casey");
    const [row] = await sql<{ topic: string; school: string; status: string }[]>`select topic, school, status from contact_messages where email = ${`visitor.${tag}@example.test`}`;
    expect(row).toEqual({ topic: "demo", school: "Summit Karate", status: "new" });
  });

  test("landing and legal pages are accessible and honest about drafts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The operating system for martial arts schools.");
    await expectNoSeriousA11yViolations(page);
    for (const p of ["/privacy", "/terms"]) {
      await page.goto(p);
      await expect(page.getByRole("note")).toContainText("Draft — legal review pending.");
      await expectNoSeriousA11yViolations(page);
    }
  });
});
