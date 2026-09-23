// Hand-authors the copilot and Home assistant fixtures (no OpenRouter key available). `npx tsx scripts/fixtures/author-copilot.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copilotStep, driftOutreach, homeAssistant, inputHash } from "@koryo/ai";
import { sid } from "../lib/ids";

const dir = join(process.cwd(), "tests/fixtures/ai");
const NOTE = "Hand-authored to the task schema (no OpenRouter key in the build environment). Numbers come from {{obs…}} placeholders filled with live tool results. Re-record with `npm run ai:record` when a key is available.";
const MAYA = sid("person:ridgeline:maya-cooper");
const COOPER = sid("household:ridgeline:cooper");
const REFUND_DOC = sid("kb_document:ridgeline:refund-policy");
const TESTING_DOC = sid("kb_document:ridgeline:testing-faq");
const write = (task: string, key: unknown, body: unknown) => {
  const h = inputHash(task, key);
  mkdirSync(join(dir, task), { recursive: true });
  writeFileSync(join(dir, task, `${h}.json`), `${JSON.stringify({ note: NOTE, ...(body as object) }, null, 2)}\n`);
  console.log(task, h);
};
const cp = (q: string, steps: unknown[]) => {
  const tools: string[] = [];
  for (const s of steps) {
    write("copilot_step", copilotStep.fixtureKey!({ question: q, school: "", today: "", history: [], observations: tools.map((t) => ({ tool: t, args: {}, result: {} })) }), { output: s });
    const st = s as { type: string; tool?: string };
    if (st.type === "tool" && st.tool) tools.push(st.tool);
  }
};

cp("How many students are past due?", [
  { type: "tool", tool: "run_report", args: { key: "past_due" } },
  { type: "answer", text: "{{obs.0.households}} families are past due — {{obs.0.invoices}} overdue invoices covering {{obs.0.students}} students, {{obs.0.total}} in total. The largest balance is {{obs.0.top.0.household}} ({{obs.0.top.0.owed}}).", citations: [{ kind: "report", id: "past_due", label: "AR aging" }] },
]);
cp("How many active students do we have?", [
  { type: "tool", tool: "run_report", args: { key: "active_students" } },
  { type: "answer", text: "You have {{obs.0.active_students}} active students, {{obs.0.trials}} on a trial and {{obs.0.leads}} leads in the pipeline.", citations: [{ kind: "report", id: "active_students", label: "Membership roster" }] },
]);
cp("What's our refund policy for testing fees?", [
  { type: "tool", tool: "kb_search", args: { query: "refund testing fee" } },
  { type: "answer", text: "Testing fees are refundable up to 48 hours before the test. If a student doesn't pass, they can retest at the next test at no extra charge.", citations: [{ kind: "kb", id: REFUND_DOC, label: "Refund policy" }, { kind: "kb", id: TESTING_DOC, label: "Belt testing FAQ" }] },
]);
cp("What was attendance over the last 4 weeks?", [
  { type: "tool", tool: "run_report", args: { key: "attendance_by_week", weeks: 4 } },
  { type: "answer", text: "{{obs.0.total}} check-ins over the last {{obs.0.weeks}} weeks and this week so far:\n- {{obs.0.by_week.0.week}}: {{obs.0.by_week.0.check_ins}}\n- {{obs.0.by_week.1.week}}: {{obs.0.by_week.1.check_ins}}\n- {{obs.0.by_week.2.week}}: {{obs.0.by_week.2.check_ins}}\n- {{obs.0.by_week.3.week}}: {{obs.0.by_week.3.check_ins}}\n- {{obs.0.by_week.4.week}}: {{obs.0.by_week.4.check_ins}}", citations: [{ kind: "report", id: "attendance_by_week", label: "Attendance" }] },
]);
cp("How is Maya Cooper doing?", [
  { type: "tool", tool: "find_person", args: { query: "Maya Cooper" } },
  { type: "tool", tool: "person_summary", args: { person_id: MAYA } },
  { type: "answer", text: "{{obs.1.name}} is {{obs.1.status}}, training in {{obs.1.programs.0.program}} at {{obs.1.programs.0.rank}}. Her last class was {{obs.1.last_class}}. The {{obs.1.household}} has {{obs.1.balance.open}} open ({{obs.1.balance.past_due}} past due).", citations: [{ kind: "person", id: MAYA, label: "Maya Cooper" }, { kind: "household", id: COOPER, label: "Cooper family" }] },
]);
cp("Draft a friendly text to Maya Cooper's family about coming back to class", [
  { type: "tool", tool: "find_person", args: { query: "Maya Cooper" } },
  { type: "tool", tool: "propose_action", args: { person_id: MAYA, channel: "sms", body: "Hi {{first_name}}! We've missed Maya on the mat lately — her spot in class is waiting whenever she's ready. Reply here if a different class time would help. — Ridgeline Taekwondo", reason: "Staff asked the copilot to invite Maya back to class." } },
  { type: "answer", text: "I drafted a friendly text to Maya's family. It's waiting in Approvals for someone to review — nothing has been sent.", citations: [{ kind: "person", id: MAYA, label: "Maya Cooper" }, { kind: "approval", id: "queue", label: "Approvals" }] },
]);

const home = (q: string, out: unknown) => write("home_assistant", homeAssistant.fixtureKey!({ question: q, school: "", studentNames: [], householdFacts: "", kb: [] }), { output: out });
home("Can I get a refund for a testing fee?", { answer: "Yes — testing fees are refundable up to 48 hours before the test. After that they aren't refundable, but if your student doesn't pass they can retest at the next test at no extra charge.", citations: [sid(`kb_chunk:${REFUND_DOC}:0`), sid(`kb_chunk:${TESTING_DOC}:0`)], escalate: false });
home("How is Riley Adams doing in class?", { answer: "I can only help with your own family, so I can't share anything about other students. If you'd like, I can pass your question to the front desk.", citations: [], escalate: true });

// Drift outreach drafts, keyed by the combination of signals (and whether we're writing to a parent).
const COMBOS: string[][] = [["absent", "attendance_drop"], ["absent", "attendance_drop", "past_due"], ["absent", "past_due"], ["absent"], ["attendance_drop", "past_due"],
  ["absent", "attendance_drop", "concern_notes"], ["absent", "concern_notes"], ["absent", "attendance_drop", "new_member"], ["absent", "new_member", "past_due"]];
const EXPLAIN: Record<string, string> = {
  attendance_drop: "attendance has dropped well below their usual pace", absent: "they haven't been to class for a while", past_due: "the family has a past-due balance",
  concern_notes: "there are recent injury, behaviour or billing notes", new_member: "they're still in their first 90 days, when habits are fragile",
};
for (const combo of COMBOS) {
  for (const minor of [true, false]) {
    const reasons = combo.map((f) => ({ factor: f, detail: f }));
    const key = driftOutreach.fixtureKey!({ school: "", studentFirstName: "", minor, level: "high", reasons });
    const explanation = `Flagged because ${combo.map((f) => EXPLAIN[f]).join(", and ")}. A personal check-in now is more likely to bring them back than a reminder later.`;
    write("drift_outreach", key, { output: minor ? {
      explanation,
      sms: "Hi {{first_name}}, it's Ridgeline! We've missed {{student}} on the mat lately — hope all is well. If a different class time would make things easier, just reply and we'll sort it out.",
      emailSubject: "We miss {{student}} at Ridgeline",
      emailBody: "Hi {{first_name}},\n\nWe've noticed {{student}} hasn't been in class as much lately and wanted to check in — no pressure at all. Kids' schedules change, and we're happy to help find a class time that fits, or to chat about how {{student}} is feeling about training.\n\nJust reply to this email or stop by the front desk. We'd love to see {{student}} back soon.\n\nWarmly,\nRidgeline Taekwondo",
    } : {
      explanation,
      sms: "Hi {{first_name}}, it's Ridgeline! We've missed you in class lately — hope all is well. If another class time would suit you better, reply and we'll help.",
      emailSubject: "We've missed you at Ridgeline",
      emailBody: "Hi {{first_name}},\n\nWe've noticed you haven't made it to class as often lately and just wanted to check in. If your schedule has changed, we're happy to help you find a class time that works, or to put your membership on hold for a few weeks.\n\nReply any time — we'd love to see you back on the mat.\n\nRidgeline Taekwondo",
    } });
  }
}
