import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const started = new Date();

test.afterAll(async () => {
  await sql`delete from communications where tenant_id = ${R} and template_key = 'promotion_congrats' and created_at >= ${started}`;
});

test.describe("@m5 Home PWA and notifications", () => {
  test.use({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });

  test("Home is installable: manifest, icons, a controlling service worker and an offline shell", async ({ page, request, context }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = (await res.json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose?: string }[] };
    expect(m).toMatchObject({ start_url: "/home", display: "standalone" });
    expect(m.name.length).toBeGreaterThan(0);
    for (const size of ["192x192", "512x512"]) expect(m.icons.some((i) => i.sizes === size && i.purpose !== "maskable")).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).headers()["content-type"]).toBe("image/png");

    await page.goto("/home");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe("/");
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    // Offline: Home navigations fall back to the cached shell (no school data is stored offline).
    await context.setOffline(true);
    await page.goto("/home/schedule").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await context.setOffline(false);
  });

  test("a queued in-app message appears in Notifications, with an unread badge that clears", async ({ page, request }) => {
    // A system message about Maya (as a promotion would queue it), then the real outbox job delivers it.
    await sql`select app.enqueue_system_message(${R}, 'promotion_congrats', ${[MAYA]}::uuid[], ${sql.json({ student_name: "Maya", rank_name: "Green belt" })}, 'person', ${MAYA})`;
    // The outbox works through its backlog oldest-first; run it until this message is delivered.
    await expect.poll(async () => {
      const run = await request.post(`/api/jobs/outbox_dispatch?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      expect(run.ok(), await run.text()).toBe(true);
      const [r] = await sql<{ status: string }[]>`select status from communications where tenant_id = ${R} and template_key = 'promotion_congrats' and channel = 'inapp' and created_at >= ${started} limit 1`;
      return r?.status;
    }, { timeout: 60_000 }).toBe("sent");

    await page.goto("/home");
    const bell = page.getByRole("link", { name: /^Notifications, \d+ new$/ });
    await expect(bell).toBeVisible();
    await bell.click();
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list.getByRole("listitem").first()).toContainText("Green belt");
    await expect(page.getByText("Push notifications aren't set up on this server yet")).toBeVisible(); // no VAPID keys here
    await expectNoSeriousA11yViolations(page);
    // Seen → marked read → the badge clears.
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible({ timeout: 10_000 });
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from communications where tenant_id = ${R} and template_key = 'promotion_congrats' and channel = 'inapp' and created_at >= ${started} and read_at is null`;
    expect(row?.n).toBe(0);
  });
});
