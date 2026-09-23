import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { sid } from "../../../scripts/lib/ids";
import { admin, sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const CLIP = join(import.meta.dirname, "../../fixtures/video/clip-6s.mp4");
const started = new Date();
let savedConsents: Record<string, unknown>[] = [];
let goldSkill = "";

const runJob = async (request: APIRequestContext, name: string) => {
  const res = await request.post(`/api/jobs/${name}?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { stats: Record<string, number> };
};

test.beforeAll(async () => {
  // Start with no AI-processing consent for Maya (restored afterwards) so the guardian flow is exercised.
  savedConsents = await sql`select * from consents where person_id = ${MAYA} and kind = 'ai_processing'`;
  await sql`delete from consents where person_id = ${MAYA} and kind = 'ai_processing'`;
});

test.afterAll(async () => {
  const subs = await sql<{ video_path: string; keyframe_paths: string[] }[]>`select video_path, keyframe_paths from technique_submissions where person_id = ${MAYA} and created_at >= ${started}`;
  const files = subs.flatMap((s) => [s.video_path, ...s.keyframe_paths]);
  if (files.length) await admin.storage.from("tenant-media").remove(files);
  await sql`delete from technique_submissions where person_id = ${MAYA} and created_at >= ${started}`;
  await sql`delete from approval_items where tenant_id = ${R} and kind = 'vision_feedback' and created_at >= ${started}`;
  await sql`delete from consents where person_id = ${MAYA} and kind = 'ai_processing'`;
  for (const c of savedConsents) await sql`insert into consents ${sql(c)}`;
  await sql`delete from schedule_suggestions where tenant_id = ${R} and created_at >= ${started}`;
  if (goldSkill) {
    const [g] = await sql<{ gold_video_path: string | null; gold_keyframe_paths: string[] }[]>`select gold_video_path, gold_keyframe_paths from skills where id = ${goldSkill}`;
    const gold = [g?.gold_video_path, ...(g?.gold_keyframe_paths ?? [])].filter((x): x is string => Boolean(x));
    if (gold.length) await admin.storage.from("tenant-media").remove(gold);
    await sql`update skills set gold_video_path = null, gold_keyframe_paths = '{}' where id = ${goldSkill}`;
  }
});

test.describe("@m4 technique feedback & schedule suggestions", () => {
  test("submit a clip → instructor reviews and edits → release → the family sees the score and 3 tips", async ({ browser, request }) => {
    test.setTimeout(180_000);
    const home = await (await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } })).newPage();
    await home.goto("/home/progress");
    const link = home.getByRole("region", { name: "Maya Cooper" }).getByRole("link", { name: /^Get feedback on / }).first();
    const skillName = ((await link.getAttribute("aria-label")) ?? "").replace("Get feedback on ", "");
    await link.click();
    await home.waitForURL(/\/submit\?student=/);
    await expect(home.getByRole("heading", { level: 1, name: `Feedback on ${skillName}` })).toBeVisible();

    // A minor: a guardian's consent comes first (and is recorded).
    await expect(home.getByLabel("Practice clip (up to 60 seconds)")).toHaveCount(0);
    await home.getByLabel(/I'm Maya's parent or guardian/).check();
    await home.getByRole("button", { name: "Record consent" }).click();
    await expect(home.getByLabel("Practice clip (up to 60 seconds)")).toBeVisible();
    const [consent] = await sql<{ granted: boolean; method: string; guardian: boolean }[]>`
      select granted, method, guardian_person_id is not null as guardian from consents where person_id = ${MAYA} and kind = 'ai_processing' order by granted_at desc limit 1`;
    expect(consent).toEqual({ granted: true, method: "home", guardian: true });
    await expectNoSeriousA11yViolations(home);

    await home.getByLabel("Practice clip (up to 60 seconds)").setInputFiles(CLIP);
    await home.getByLabel(/Anything the instructor should know/).fill("Working on my chamber");
    await home.getByRole("button", { name: "Submit for feedback" }).click();
    const clips = home.getByRole("list", { name: "Your clips" });
    await expect(clips.getByRole("listitem").first()).toContainText("Waiting to be analysed");

    // The instructor's reference clip for this skill is used alongside the student's frames.
    const owner = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await owner.goto(`/desk/curriculum?q=${encodeURIComponent(skillName)}`);
    await owner.getByLabel(`Reference clip for ${skillName}`).setInputFiles(CLIP);
    await expect(owner.getByText("Reference clip set")).toBeVisible();
    const [sk] = await sql<{ id: string }[]>`select id from skills where tenant_id = ${R} and name = ${skillName} and gold_video_path is not null`;
    goldSkill = sk?.id ?? "";
    expect(goldSkill).not.toBe("");

    // The job extracts 6 keyframes and drafts rubric feedback for review; the family still sees nothing.
    const r = await runJob(request, "technique_feedback");
    expect(r.stats.review).toBe(1);
    const [sub] = await sql<{ status: string; frames: number; feedback: unknown; duration_ms: number }[]>`
      select status, cardinality(keyframe_paths) as frames, feedback, duration_ms from technique_submissions where person_id = ${MAYA} and created_at >= ${started}`;
    expect(sub).toMatchObject({ status: "review", frames: 6, feedback: null });
    expect(sub?.duration_ms).toBeGreaterThan(5500);
    await home.reload();
    await expect(clips.getByRole("listitem").first()).toContainText("With your instructor");
    await expect(home.getByRole("list", { name: "Tips" })).toHaveCount(0);

    // Instructor on the Mat: frames, rubric, edit a tip, release.
    const mat = await (await browser.newContext({ storageState: authState("ridgeline", "instructor"), viewport: { width: 820, height: 1180 } })).newPage();
    await mat.goto("/mat/reviews");
    const card = mat.getByRole("article").filter({ hasText: "Working on my chamber" });
    await expect(card.getByRole("list", { name: "Keyframes" }).getByRole("img")).toHaveCount(6);
    await expect(card).toContainText("Working on my chamber");
    await expect(card.getByText("dev fixture")).toBeVisible();
    await expect(card.getByLabel("Summary")).toHaveValue(/Compared with the reference/);
    const [gk] = await sql<{ n: number }[]>`select cardinality(gold_keyframe_paths) as n from skills where id = ${goldSkill}`;
    expect(gk?.n).toBe(4);
    await card.getByLabel("Tip 3").fill("Re-chamber before landing, then return to fighting stance — show me on Saturday!");
    await expectNoSeriousA11yViolations(mat);
    await card.getByRole("button", { name: "Release to student" }).click();
    await expect(mat.getByText("Released to Maya Cooper")).toBeVisible();
    await expect(mat.getByRole("article").filter({ hasText: skillName }).filter({ hasText: "Working on my chamber" })).toHaveCount(0);

    await home.reload();
    const released = clips.getByRole("listitem").first();
    await expect(released).toContainText("Feedback ready");
    await expect(released.getByRole("list", { name: "Tips" }).getByRole("listitem")).toHaveCount(3);
    await expect(released).toContainText("show me on Saturday!");
    await expect(released).toContainText("/ 5 overall");
    await expectNoSeriousA11yViolations(home);
  });

  test("weekly schedule suggestions appear on the Desk dashboard", async ({ browser, request }) => {
    await sql`delete from schedule_suggestions where tenant_id = ${R}`;
    const r = await runJob(request, "schedule_suggestions");
    expect(r.stats.suggestions).toBeGreaterThan(0);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk");
    const list = desk.getByRole("list", { name: "Schedule suggestions" });
    await expect(list.getByRole("listitem").first()).toBeVisible();
    const count = await list.getByRole("listitem").count();
    expect(count).toBeGreaterThanOrEqual(1);
    const [top] = await sql<{ title: string }[]>`select title from schedule_suggestions where tenant_id = ${R} and kind = 'add_section' limit 1`;
    await expect(list).toContainText(top?.title ?? "");
    await list.getByRole("button", { name: `Dismiss: ${top?.title ?? ""}` }).click();
    await expect(list.getByRole("listitem")).toHaveCount(count - 1);
    await expectNoSeriousA11yViolations(desk);
  });
});
