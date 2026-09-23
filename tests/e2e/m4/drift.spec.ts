import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const started = new Date();

test.afterAll(async () => {
  const items = await sql<{ id: string }[]>`select id from approval_items where tenant_id = ${R} and kind = 'drift_outreach' and created_at >= ${started}`;
  const ids = items.map((i) => i.id);
  if (ids.length) {
    await sql`delete from communications where related_type = 'approval_item' and related_id = any(${ids}::uuid[])`;
    await sql`update risk_scores set approval_item_id = null where approval_item_id = any(${ids}::uuid[])`;
    await sql`delete from approval_items where id = any(${ids}::uuid[])`;
  }
});

test.describe("@m4 drift detector", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("nightly job → dashboard 'At risk' → ranked list with reasons → approve the drafted outreach → queued", async ({ page, request }) => {
    test.setTimeout(120_000);
    const run = async () => {
      const res = await request.post(`/api/jobs/drift_score?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as { stats: { scored: number; high: number; drafted: number } };
    };
    const first = await run();
    expect(first.stats.scored).toBeGreaterThan(50);

    // Truth: high-risk students all show a real signal in the raw data (attendance drop or absence).
    const high = await sql<{ person_id: string; score: number; factors: string[] }[]>`
      select person_id, score, array(select jsonb_array_elements(reasons) ->> 'factor') as factors from v_risk_latest where tenant_id = ${R} and level = 'high' order by score desc, person_id`;
    expect(high.length).toBeGreaterThan(0);
    for (const h of high) expect(h.factors.some((f) => f === "attendance_drop" || f === "absent")).toBe(true);

    await page.goto("/desk");
    const card = page.getByRole("link", { name: /At risk/ });
    await expect(card).toContainText(String(high.length));
    await card.click();
    await page.waitForURL(/risk=high/);
    const list = page.getByRole("list", { name: "Students at risk" });
    await expect(list.getByRole("listitem")).toHaveCount(high.length);
    const [top] = await sql<{ person_name: string }[]>`select person_name from v_risk_latest where tenant_id = ${R} and level = 'high' order by score desc limit 1`;
    await expect(list.getByRole("listitem").first()).toContainText(top?.person_name ?? "");
    await expectNoSeriousA11yViolations(page);

    // The seeded decaying student shows up among those worth a check-in.
    await page.goto("/desk/people?risk=medium");
    await expect(page.getByRole("list", { name: "Students at risk" }).getByRole("listitem", { name: "Riley Adams" })).toBeVisible();

    // Drafted outreach waits in Approvals; approving queues it.
    const drafts = await sql<{ id: string; title: string }[]>`select id, title from approval_items where tenant_id = ${R} and kind = 'drift_outreach' and status = 'pending' order by created_at`;
    expect(drafts.length).toBeGreaterThan(0);
    await page.goto("/desk/inbox/approvals?kind=drift_outreach");
    const card1 = page.getByRole("article", { name: drafts[0]?.title ?? "" }).first();
    await expect(card1.getByRole("textbox", { name: "Text message" })).not.toHaveValue(/\{\{student\}\}/);
    await card1.getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByText(/Approved — \d+ messages? queued/)).toBeVisible();
    const [sent] = await sql<{ n: number }[]>`select count(*)::int as n from communications where related_type = 'approval_item' and related_id = ${drafts[0]?.id ?? ""}`;
    expect(sent?.n).toBeGreaterThan(0);

    // Re-running doesn't draft the same students again.
    const before = await sql<{ n: number }[]>`select count(*)::int as n from approval_items where tenant_id = ${R} and kind = 'drift_outreach'`;
    const again = await run();
    expect(again.stats.drafted).toBe(0);
    const after = await sql<{ n: number }[]>`select count(*)::int as n from approval_items where tenant_id = ${R} and kind = 'drift_outreach'`;
    expect(after[0]?.n).toBe(before[0]?.n);
  });
});
