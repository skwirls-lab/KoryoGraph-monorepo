import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails on serious/critical WCAG 2.x A/AA violations, listing rule ids and targets. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  // Measure settled colours: a button mid-transition (e.g. disabled → enabled opacity) would read as low contrast.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
  expect(serious, serious.join("\n")).toEqual([]);
}
