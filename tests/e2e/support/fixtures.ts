import { test as base, expect } from "@playwright/test";

/**
 * Every spec imports `test` from here: the page fails the test on uncaught page errors and on
 * React/Next console errors (hydration mismatches, key warnings…). Network status logs such as an
 * expected 403 are not app errors and are ignored.
 */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/Failed to load resource/.test(t)) return;
        errors.push(`console: ${t.slice(0, 400)}`);
      });
      await use();
      expect(errors, errors.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
