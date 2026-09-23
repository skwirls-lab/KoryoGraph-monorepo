import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const REPORTS = [
  { path: "funnel", title: "Trial funnel", header: "month,source,leads,trials_booked,trials_attended,enrolled,lost" },
  { path: "retention", title: "Retention cohorts", header: "cohort,month_index,cohort_size,retained,retained_pct" },
  { path: "churn", title: "Churn", header: "member,plan,status,started,ended,tenure_months,reason,still_member" },
  { path: "eligibility", title: "Testing eligibility", header: "student,program,current_rank,next_rank,status,missing" },
  { path: "staff-sessions", title: "Staff sessions", header: "month,instructor,sessions,hours" },
  { path: "events", title: "Event revenue", header: "event,kind,date,registrations,invoiced,collected,outstanding" },
] as const;

test.describe("@m3 growth reports", () => {
  test("each growth report renders from live data, passes axe and exports its CSV", async ({ browser }) => {
    test.setTimeout(120_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/reports");
    for (const r of REPORTS) {
      await desk.goto("/desk/reports");
      await desk.getByRole("link", { name: new RegExp(`^${r.title}`) }).click();
      await expect(desk.getByRole("heading", { level: 1, name: r.title })).toBeVisible();
      await expectNoSeriousA11yViolations(desk);
      const href = await desk.getByRole("link", { name: "Export CSV" }).getAttribute("href");
      const csv = await desk.request.get(href ?? "");
      expect(csv.status(), r.path).toBe(200);
      expect((await csv.text()).split(/\r?\n/)[0]).toBe(r.header);
    }
    // A parent can't pull report CSVs.
    const parent = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    const denied = await parent.request.get("/desk/reports/growth/export?report=churn");
    expect(denied.status()).toBe(403);
  });
});
