// Hand-authors the copilot and Home assistant fixtures (no OpenRouter key available). `npx tsx scripts/fixtures/author-copilot.ts`
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { actionBoard, billingRecovery, importMapping, copilotStep, driftOutreach, homeAssistant, inputHash, leadNextAction, lessonBuilder, nlReport, packingSlip, parentNarrative, scheduleSuggestion, SUGGESTION_KINDS, techniqueFeedback, transcribe } from "@koryo/ai";
import { AB, AB_TRANSCRIPT } from "../../tests/fixtures/action-board";
import { DEMO_CLASS, DEMO_CLASS_TRANSCRIPT } from "../../tests/fixtures/demo-class";
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
// §6 step 11: a combined question, then a bulk draft (one per family) that only lands in Approvals.
cp("Which families are past due and haven't attended in 3 weeks?", [
  { type: "tool", tool: "run_report", args: { key: "past_due_absent" } },
  { type: "answer", text: "{{obs.0.households}} families have an overdue balance and no student in class for 3 weeks or more — {{obs.0.total}} in total:\n{{obs.0.list}}", citations: [{ kind: "report", id: "past_due_absent", label: "AR aging" }] },
]);
cp("Draft a friendly SMS to them", [
  { type: "tool", tool: "propose_messages", args: { report: "past_due_absent", channel: "sms", body: "Hi {{first_name}}, we've missed you at Ridgeline Taekwondo! Your spot on the mat is waiting. If anything's making class or the balance on your account tricky right now, just reply — we're happy to help.", reason: "Staff asked the copilot to check in with past-due families who haven't been to class in 3 weeks." } },
  { type: "answer", text: "I drafted a friendly text for each of the {{obs.0.created}} families. They're waiting in Approvals for someone to review — nothing has been sent.", citations: [{ kind: "report", id: "past_due_absent", label: "AR aging" }, { kind: "approval", id: "queue", label: "Approvals" }] },
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

// Action board (M4.06): the transcript of the spec's class, and the tone WAV that "transcribes" to it.
{
  const wav = readFileSync(join(process.cwd(), "tests/fixtures/audio/class-short.wav"));
  const sha256 = createHash("sha256").update(wav).digest("hex");
  write("transcribe", transcribe.fixtureKey!({ audioBase64: "", format: "mp3", sha256 }), { output: { transcript: AB_TRANSCRIPT } });
  const [ari, bea, cal, dee, eli, ...rest] = AB.students;
  const jo = AB.students.find((s) => s.first === "Jo");
  write("action_board", actionBoard.fixtureKey!({ className: "", transcript: AB_TRANSCRIPT, roster: [], skills: [] }), { output: {
    attendance: [...[ari, bea, cal, dee, eli, ...rest.filter((s) => s.first !== "Jo")].map((s) => ({ personId: s!.id, evidence: `named as here tonight`, confidence: 0.95 })),
      { personId: jo!.id, evidence: "“I think Jo was in the back row but I'm not sure”", confidence: 0.45 }],
    skillNotes: [
      { personId: ari!.id, skillId: AB.skills.lowBlock, note: "Nailed the low block", signOff: true, confidence: 0.92 },
      { personId: bea!.id, skillId: AB.skills.frontKick, note: "Front kick is ready", signOff: true, confidence: 0.9 },
      { personId: cal!.id, skillId: AB.skills.taegeuk1, note: "Performed Taegeuk 1 cleanly", signOff: true, confidence: 0.88 },
    ],
    injuries: [{ personId: dee!.id, note: "Rolled her ankle a little during sparring; keep an eye on it next class.", confidence: 0.9 }],
    followUps: [{ title: "Call Eli's parents about moving up to the advanced class", personId: eli!.id }],
  } });
}

// Lesson builder (M4.07): plans that reference real demo-library skills (and one bogus id, which must be dropped).
{
  const sk = (cat: string, name: string) => sid(`skill:ridgeline:${cat}:${name}`);
  const key = (prompt: string, weeks: number) => lessonBuilder.fixtureKey!({ prompt, programName: "Youth Taekwondo", rankBand: [], weeks, classMinutes: 55, skills: [] });
  write("lesson_builder", key("A 2-week sparring block for green to blue belts: footwork, counters and ring awareness", 2), { output: {
    plans: [
      { name: "Sparring block · week 1: footwork & distance", week: 1, sections: [
        { title: "Warm-up", minutes: 8, skillIds: [sk("conditioning", "Jump rope 2 min")], notes: "Rope, then dynamic stretching; finish with 20 s of fast feet." },
        { title: "Footwork", minutes: 15, skillIds: [sk("sparring", "Fighting stance & footwork"), sk("sparring", "Ring awareness")], notes: "Step-in / step-back / pivot ladder drills; partner mirrors to keep distance." },
        { title: "Counters", minutes: 15, skillIds: [sk("sparring", "Roundhouse counter"), "00000000-0000-4000-8000-000000000000"], notes: "Partner throws roundhouse; defender slides back and counters." },
        { title: "Controlled rounds", minutes: 12, skillIds: [sk("sparring", "Controlled light contact"), sk("sparring", "Sparring etiquette")], notes: "3 × 90 s rounds, rotate partners; coaches call out ring position." },
        { title: "Cool-down", minutes: 5, skillIds: [], notes: "Stretch, bow out, one takeaway each." },
      ] },
      { name: "Sparring block · week 2: counters under pressure", week: 2, sections: [
        { title: "Warm-up", minutes: 8, skillIds: [sk("conditioning", "Agility ladder")], notes: "Ladder patterns, then shadow sparring." },
        { title: "Timing", minutes: 15, skillIds: [sk("sparring", "Cut kick timing"), sk("sparring", "Counter back kick")], notes: "Pad holder feeds; students pick cut kick or back kick counter." },
        { title: "Ring craft", minutes: 12, skillIds: [sk("sparring", "Ring awareness"), sk("sparring", "Feint and switch")], notes: "Start near the edge; escape with a feint and switch." },
        { title: "Rounds", minutes: 15, skillIds: [sk("sparring", "Point sparring rules")], notes: "Point rounds with a scorer; review two exchanges per pair." },
        { title: "Cool-down", minutes: 5, skillIds: [], notes: "Stretch and bow out." },
      ] },
    ],
    suggestedSkills: [{ name: "Corner escape drill", category: "sparring", reason: "Week 2 works on escaping the ring edge, which your library doesn't have a skill for." }],
  } });
  write("lesson_builder", key("Roundhouse counters and footwork with partner drills", 1), { output: {
    plans: [{ name: "Roundhouse counters & footwork", week: 1, sections: [
      { title: "Warm-up", minutes: 8, skillIds: [sk("conditioning", "Jump rope 2 min")], notes: "Rope and dynamic stretching." },
      { title: "Footwork", minutes: 15, skillIds: [sk("sparring", "Fighting stance & footwork")], notes: "Mirror drill with a partner." },
      { title: "Counters", minutes: 20, skillIds: [sk("sparring", "Roundhouse counter")], notes: "Slide back and counter; switch roles every 10 reps." },
      { title: "Games & cool-down", minutes: 12, skillIds: [], notes: "Tag-the-belt game, stretch, bow out." },
    ] }],
    suggestedSkills: [],
  } });
}

// Document intake (M4.08): what a vision model reads from tests/fixtures/docs/century-packing-slip.png.
{
  const png = readFileSync(join(process.cwd(), "tests/fixtures/docs/century-packing-slip.png"));
  const sha256 = createHash("sha256").update(png).digest("hex");
  write("packing_slip", packingSlip.fixtureKey!({ mime: "image/png", base64: "", sha256, fileName: "" }), { output: {
    supplier: "Dojo Supply Co.", reference: "DS-48812",
    lines: [
      { description: "Student uniform, white, size 2", skuText: "DOBOK-2", quantity: 10, unitCostCents: 2200 },
      { description: "Student uniform, white, size 3", skuText: "DOBOK-3", quantity: 8, unitCostCents: 2200 },
      { description: "Sparring gear set, medium", skuText: "SPARRING-SET-M", quantity: 4, unitCostCents: 4100 },
      { description: "Mouthguard, youth", skuText: "MOUTHGUARD-YOUTH", quantity: 20, unitCostCents: 150 },
      { description: "White belt, size 2", skuText: "WHITE-BELT-2", quantity: 12, unitCostCents: 210 },
      { description: "Focus mitts pair", skuText: "FM-PR", quantity: 6, unitCostCents: 1800 },
      { description: "Rebreakable board, black (hard)", skuText: "RB-BLK", quantity: 2, unitCostCents: 2400 },
    ],
  } });
}

// NL reports (M4.09): real SQL over the nl views — the rows come from live data.
{
  const nl = (q: string, out: unknown) => write("nl_report", nlReport.fixtureKey!({ question: q, today: "", school: "" }), { output: out });
  nl("attendance by program, last 8 weeks", { title: "Attendance by program — last 8 weeks",
    sql: "select week_start, program, sum(check_ins) as check_ins from v_attendance_weekly where week_start >= date_trunc('week', current_date)::date - 56 and week_start < date_trunc('week', current_date)::date group by week_start, program order by week_start, program",
    chart: { type: "line", x: "week_start", y: ["check_ins"], series: "program" }, explanation: "Weekly check-ins for each program over the last 8 complete weeks (a class that serves two programs counts for both)." });
  nl("revenue by category for the last 6 months", { title: "Revenue by category — last 6 months",
    sql: "select to_char(month, 'YYYY-MM') as month, category, round(sum(net_cents) / 100.0, 2) as revenue from v_revenue_monthly where month >= date_trunc('month', current_date)::date - interval '5 months' group by 1, 2 order by 1, 2",
    chart: { type: "bar", x: "month", y: ["revenue"], series: "category" }, explanation: "Invoiced revenue before tax, in dollars, by month and category." });
  nl("which members haven't attended in 30 days", { title: "Active members with no class in 30 days",
    sql: "select display_name, programs, last_attended_on from v_members where status = 'active' and (last_attended_on is null or last_attended_on < current_date - 30) order by last_attended_on nulls first, display_name",
    chart: { type: "table", x: null, y: [], series: null }, explanation: "Active members whose last check-in was more than 30 days ago (or who never checked in)." });
  nl("trial funnel by source", { title: "Trial funnel by lead source",
    sql: "select source, sum(leads) as leads, sum(trials_booked) as trials_booked, sum(trials_attended) as trials_attended, sum(won) as enrolled from v_trial_funnel group by source order by leads desc",
    chart: { type: "bar", x: "source", y: ["leads", "trials_booked", "trials_attended", "enrolled"], series: null }, explanation: "All-time leads per source and how far they got." });
}

// Growth agents (M4.10). Facts are placeholders filled with the real invoice / week / lead.
{
  const tones = { 1: "gentle", 2: "firm", 3: "final" } as const;
  for (const stage of [1, 2, 3] as const) {
    for (const established of [false, true]) {
      const thanks = established ? "Thank you for being part of our school for so long. " : "";
      const out = {
        1: { sms: "Hi {{first_name}}, a heads-up: your {{amount}} payment didn't go through. You can update it here: {{link}}", emailSubject: "Your payment didn't go through",
          emailBody: `Hi {{first_name}},\n\n${thanks}Your latest payment of {{amount}} didn't go through — this happens, often with an expired or replaced card.\n\nYou can pay or update your card here: {{link}}\n\nIf anything's changed for your family, just reply and we'll work it out together.` },
        2: { sms: "Hi {{first_name}}, a reminder that {{amount}} is still outstanding on your membership. Pay or update your card: {{link}}", emailSubject: "Reminder: payment still outstanding",
          emailBody: `Hi {{first_name}},\n\n${thanks}We still haven't been able to collect {{amount}} for your membership. Please pay or update your card here: {{link}}\n\nIf you'd like to talk about a different plan or timing, reply to this email — we're happy to help.` },
        3: { sms: "Hi {{first_name}}, {{amount}} is still unpaid and your membership will be paused soon. Please pay here: {{link}} or reply to talk.", emailSubject: "Final notice: your membership will be paused",
          emailBody: `Hi {{first_name}},\n\n${thanks}We've tried a few times to collect {{amount}} and haven't been able to. To keep training uninterrupted, please pay here: {{link}}\n\nIf we don't hear from you, the membership will be paused (not cancelled) until it's settled. If something's going on, reply — we'd much rather find a way that works for you.` },
      }[stage];
      write("billing_recovery", billingRecovery.fixtureKey!({ school: "", stage, daysOverdue: 0, tenureMonths: established ? 12 : 0, previousFailures: 0, cardOnFile: false }), { output: { tone: tones[stage], ...out } });
    }
  }
  for (const classes of [0, 1, 3]) {
    for (const skills of [false, true]) {
      for (const promoted of [false, true]) {
        const parts = [
          classes === 0 ? "{{student}} didn't make it to class this week — we missed them and look forward to seeing them back on the mat." : classes === 1 ? "{{student}} trained with us this week and put in solid effort." : "{{student}} was at {{classes}} classes this week — great consistency.",
          skills ? "They were signed off on {{skills}}, which is real progress toward their next rank." : classes > 0 ? "They're building good habits and steady technique." : "",
          promoted ? "And big news: {{student}} was promoted to {{promotion}}. Congratulations!" : "",
          "Keep encouraging them at home — it makes a difference.",
        ].filter(Boolean);
        write("parent_narrative", parentNarrative.fixtureKey!({ school: "", student: "", classes, skills: skills ? ["x"] : [], promotion: promoted ? "x" : null, instructorNotes: [] }), { output: { body: parts.join(" ") } });
      }
    }
  }
  const NEXT: Record<string, [string, string]> = {
    new: ["Call today to welcome them and book a trial class", "Send a friendly check-in text with two trial times"],
    contacted: ["Follow up with two specific trial class times", "Try a different channel: text if you called, call if you emailed"],
    trial_scheduled: ["Send a reminder the day before the trial class", "Confirm the trial is still on and offer a new time"],
    trial_attended: ["Call to ask how the trial went and present the offer", "Send the offer with a start date this week"],
    offer: ["Ask if they have questions and help them enroll", "Check in on the offer; ask what's holding them back"],
  };
  for (const [stage, [fresh, stale]] of Object.entries(NEXT)) {
    for (const [trialBooked, trialAttended] of [[false, false], [true, false], [true, true]] as const) {
      for (const isStale of [false, true]) {
        const nextAction = trialAttended && ["new", "contacted", "trial_scheduled"].includes(stage) ? "They attended a trial: call to present the enrollment offer"
          : trialBooked && !trialAttended && ["new", "contacted"].includes(stage) ? "Confirm their booked trial class and send directions" : isStale ? stale : fresh;
        write("lead_next_action", leadNextAction.fixtureKey!({ school: "", stage, trialBooked, trialAttended, hasMessage: false, lastTouchDays: isStale ? 15 : 0, score: 0 }), { output: { nextAction } });
      }
    }
  }
}

// Technique feedback (M4.11): keyed to tests/fixtures/video/clip-6s.mp4 (a synthetic test clip — see its README).
{
  const sha256 = createHash("sha256").update(readFileSync(join(process.cwd(), "tests/fixtures/video/clip-6s.mp4"))).digest("hex");
  for (const gold of [false, true]) {
    write("technique_feedback", techniqueFeedback.fixtureKey!({ skill: "", category: "", description: "", rubric: [], frames: [], goldFrames: gold ? ["x"] : [], sha256 }), { output: {
      scores: [
        { criterion: "Technique", score: 3, note: "The knee comes up before the kick, but the foot extends a little early — finish the chamber first." },
        { criterion: "Power & focus", score: 4, note: "Good snap at full extension; eyes stay on the target." },
        { criterion: "Balance & control", score: 3, note: "The supporting heel lifts at the end; keep it planted and pivot slightly." },
      ],
      summary: gold ? "Solid kick with a clear snap. Compared with the reference, the chamber is lower and the recovery a little slower." : "Solid kick with a clear snap. Tidy the chamber and keep the supporting foot planted and it will look sharp.",
      tips: [
        "Practise ten slow chambers holding the knee high for two seconds before extending.",
        "Keep the supporting heel down through the whole kick; pivot on the ball of the foot.",
        "Re-chamber before setting the foot down, then return to fighting stance.",
      ],
    } });
  }
}

// Schedule suggestions (M4.11): wording per kind; the numbers are placeholders filled from the real stats.
{
  const words: Record<(typeof SUGGESTION_KINDS)[number], { title: string; rationale: string }> = {
    add_section: { title: "Add a second {{class}} section on {{day}}", rationale: "{{class}} at {{time}} has run at {{utilization}} of capacity for four weeks — a second section keeps it welcoming for new students." },
    merge: { title: "Fold the {{day}} {{class}} into {{other_class}}", rationale: "{{class}} ({{day}} {{time}}) has averaged only {{utilization}} of capacity; combining it with {{other_class}} frees an instructor slot without turning anyone away." },
    move: { title: "Try a new time for {{class}}", rationale: "{{class}} on {{day}} at {{time}} is averaging {{utilization}} of capacity; ask its regulars which day or time would work better." },
    no_show: { title: "Tackle no-shows in {{class}}", rationale: "{{no_show}} of bookings for {{class}} ({{day}} {{time}}) were no-shows; a reminder the evening before usually cuts that in half." },
  };
  for (const kind of SUGGESTION_KINDS) {
    write("schedule_suggestion", scheduleSuggestion.fixtureKey!({ school: "", kind, className: "", weekday: "", time: "", utilization: 0, waitlistPerSession: 0, noShowRate: 0, otherClass: null }), { output: words[kind] });
  }
}

// The demo seed's recorded class (M4.12): tone WAV → transcript → a 9 / 3 / 1 board about real seeded students.
{
  const wav = readFileSync(join(process.cwd(), "tests/fixtures/audio/demo-class.wav"));
  const sha256 = createHash("sha256").update(wav).digest("hex");
  write("transcribe", transcribe.fixtureKey!({ audioBase64: "", format: "mp3", sha256 }), { output: { transcript: DEMO_CLASS_TRANSCRIPT } });
  const P = DEMO_CLASS.present;
  write("action_board", actionBoard.fixtureKey!({ className: "", transcript: DEMO_CLASS_TRANSCRIPT, roster: [], skills: [] }), { output: {
    attendance: [...Object.values(P).map((personId) => ({ personId, evidence: "named in tonight's list", confidence: 0.95 })),
      { personId: DEMO_CLASS.unsure.joesph, evidence: "“I think Joesph came in late at the back but I didn't see him check in”", confidence: 0.4 }],
    skillNotes: [
      { personId: P.berry, skillId: DEMO_CLASS.skills.doubleRoundhouse, note: "Both kicks at head height, landed balanced.", signOff: true, confidence: 0.92 },
      { personId: P.sabina, skillId: DEMO_CLASS.skills.taegeukOh, note: "Start to finish with sharp stances.", signOff: true, confidence: 0.93 },
      { personId: P.edmond, skillId: DEMO_CLASS.skills.oneStep5, note: "Clean and controlled.", signOff: true, confidence: 0.9 },
    ],
    injuries: [{ personId: P.greta, note: "Jammed wrist on the speed break, a bit swollen — no breaking next class.", confidence: 0.88 }],
    followUps: [{ title: "Call Louisa's parents about Demo Team tryouts", personId: P.louisa }],
  } });
}

// Import mapping assist (M5.03): tests/fixtures/import/other-vendor.csv (headers only — the task never sees values).
{
  const headers = ["Kid's name", "Surname", "Born", "Mum or Dad email", "Style", "Belt colour", "Joined"];
  write("import_mapping", importMapping.fixtureKey!({ columns: headers.map((header) => ({ header, shape: "text", filled: 1 })), fields: [] }), { output: { mapping: [
    { header: "Kid's name", field: "first_name", confidence: 0.9 }, { header: "Surname", field: "last_name", confidence: 0.95 },
    { header: "Born", field: "dob", confidence: 0.9 }, { header: "Mum or Dad email", field: "guardian_email", confidence: 0.9 },
    { header: "Style", field: "program", confidence: 0.75 }, { header: "Belt colour", field: "rank", confidence: 0.9 }, { header: "Joined", field: "start_date", confidence: 0.8 },
  ] } });
}
