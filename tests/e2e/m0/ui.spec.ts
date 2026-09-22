import { expect, test } from "../support/fixtures";

for (const theme of ["koryo-red", "light"] as const) {
  test(`@m0 /dev/ui renders every component in ${theme} without console errors`, async ({ page, context, baseURL }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await context.addCookies([{ name: "kg-theme", value: theme, url: baseURL ?? "http://localhost:3100" }]);
    await page.goto("/dev/ui");

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { name: "KoryoGraph UI kit" })).toBeVisible();
    for (const t of ["koryo-red", "dark", "light", "midnight", "warm"]) {
      await expect(page.getByRole("region", { name: `Theme ${t}` })).toBeVisible();
    }

    await page.screenshot({ path: testInfo.outputPath(`dev-ui-${theme}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
