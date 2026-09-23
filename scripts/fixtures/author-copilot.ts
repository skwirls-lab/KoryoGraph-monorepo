// Hand-authors the copilot and Home assistant fixtures (no OpenRouter key available). `npx tsx scripts/fixtures/author-copilot.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copilotStep, homeAssistant, inputHash } from "@koryo/ai";
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
