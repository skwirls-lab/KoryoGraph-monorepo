import { addDaysStr } from "@koryo/billing";
import { zonedWallTimeToUtc } from "@koryo/scheduling";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import type { DemoPeople } from "./people";
import { insertChunks, type Rng } from "./rng";

// Demo seed v3 (M3.08): the pipeline, next Saturday's belt test, events, after-school, staff ops,
// automations with run history and sent broadcasts. Loaded with user triggers disabled (like the rest of
// the demo), so every row a trigger would have written is written here explicitly; money is recomputed after.

const T = "ridgeline";
const tid = () => sid(`tenant:${T}`);
const LOC = () => sid(`location:${T}:main`);
const user = (email: string) => sid(`user:${email}`);

export interface GrowStats { leads: number; events: number; eventRegistrations: number; afterschoolKids: number; afterschoolDays: number; automationRuns: number; broadcastMessages: number }

export async function seedGrow(ctx: SeedContext, rng: Rng, now: Date, people: DemoPeople): Promise<GrowStats> {
  const { sql } = ctx;
  const t = tid();
  const [{ tz } = { tz: "America/New_York" }] = await sql<{ tz: string }[]>`select timezone as tz from public.tenants where id = ${t}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const at = (date: string, time: string) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const [h, mi] = time.split(":").map(Number) as [number, number];
    return zonedWallTimeToUtc({ year: y, month: m, day: d, hour: h, minute: mi }, tz).toISOString();
  };
  const nextDow = (target: number, minDays = 1) => { let d = addDaysStr(today, minDays); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== target) d = addDaysStr(d, 1); return d; };
  const clock = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  let invoiceNo = (await sql<{ value: number }[]>`select coalesce((select value from public.tenant_counters where tenant_id = ${t} and name = 'invoice'), 0)::int as value`)[0]?.value ?? 0;
  const invRows: Record<string, unknown>[] = [];
  const lineRows: Record<string, unknown>[] = [];
  const payRows: Record<string, unknown>[] = [];
  const allocRows: Record<string, unknown>[] = [];
  /** An invoice with one line; `paidOn` pays it in full (cash/check history — card history needs Stripe). */
  const invoice = (key: string, o: { household: string; person?: string | null; total: number; source: string; memo: string; kind: string; description: string; refType: string; refId: string; issued: string; due: string; paidOn?: string | null; membership?: string; periodStart?: string; periodEnd?: string }) => {
    const id = sid(`invoice:${T}:${key}`);
    invoiceNo += 1;
    invRows.push({ id, tenant_id: t, household_id: o.household, person_id: o.person ?? null, membership_id: o.membership, number: invoiceNo, status: "open", issued_at: at(o.issued, "09:00"), due_at: o.due,
      period_start: o.periodStart, period_end: o.periodEnd, subtotal_cents: o.total, total_cents: o.total, source: o.source, memo: o.memo, created_at: at(o.issued, "09:00") });
    lineRows.push({ id: sid(`invoice_line:${T}:${key}`), tenant_id: t, invoice_id: id, kind: o.kind, description: o.description, quantity: 1, unit_cents: o.total, total_cents: o.total, tax_cents: 0, ref_type: o.refType, ref_id: o.refId });
    if (o.paidOn && o.total > 0) {
      const pid = sid(`payment:${T}:${key}`);
      payRows.push({ id: pid, tenant_id: t, household_id: o.household, invoice_id: id, amount_cents: o.total, method: rng.chance(0.6) ? "cash" : "check", status: "succeeded", received_at: at(o.paidOn, clock(rng.int(15, 18), rng.int(0, 59))) });
      allocRows.push({ id: sid(`allocation:${T}:${key}`), tenant_id: t, payment_id: pid, invoice_id: id, amount_cents: o.total, created_at: at(o.paidOn, "18:30") });
    }
    return id;
  };
  /** Invoices (and their lines/payments) go in before the rows that reference them. */
  const flushMoney = async () => {
    await insertChunks(sql, "invoices", invRows.splice(0));
    await insertChunks(sql, "invoice_lines", lineRows.splice(0));
    await insertChunks(sql, "payments", payRows.splice(0));
    await insertChunks(sql, "payment_allocations", allocRows.splice(0));
  };
  const householdOf = new Map(people.students.map((s) => [s.id, s.householdId]));
  const kids = people.students.filter((s) => s.status === "active" && s.minor);

  // ------------------------------------------------------------------ CRM: 9 leads across stages
  const stages = new Map((await sql<{ key: string; id: string }[]>`select key, id from public.pipeline_stages where tenant_id = ${t}`).map((s) => [s.key, s.id]));
  const leadPeople = await sql<{ id: string; first_name: string; source: string | null; utm: Record<string, string>; created_at: Date }[]>`
    select id, first_name, source, utm, created_at from public.people where tenant_id = ${t} and status = 'lead' order by id`;
  const trialSessions = await sql<{ id: string; starts_at: Date; name: string }[]>`
    select s.id, s.starts_at, s.name from public.class_sessions s where s.tenant_id = ${t} and s.bookable and s.status = 'scheduled'
      and s.program_ids @> array[${sid(`program:${T}:youth-tkd`)}]::uuid[] and s.starts_at between ${now} and ${new Date(now.getTime() + 7 * 86_400_000)} order by s.starts_at limit 2`;
  const [pastTrial] = await sql<{ id: string; starts_at: Date; name: string }[]>`
    select s.id, s.starts_at, s.name from public.class_sessions s where s.tenant_id = ${t} and s.bookable and s.status <> 'cancelled'
      and s.program_ids @> array[${sid(`program:${T}:youth-tkd`)}]::uuid[] and s.starts_at between ${new Date(now.getTime() - 5 * 86_400_000)} and ${new Date(now.getTime() - 86_400_000)} order by s.starts_at desc limit 1`;
  const STAGE_PLAN = ["new", "new", "contacted", "contacted", "trial_scheduled", "trial_scheduled", "trial_attended", "offer", "lost"] as const;
  const leadRows: Record<string, unknown>[] = [];
  const activityRows: Record<string, unknown>[] = [];
  const bookingRows: Record<string, unknown>[] = [];
  const attendanceRows: Record<string, unknown>[] = [];
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  leadPeople.forEach((p, i) => {
    const key = STAGE_PLAN[i] ?? "new";
    const id = sid(`lead:${T}:${p.id}`);
    const created = p.created_at;
    let trialBooking: string | null = null;
    activityRows.push({ id: sid(`lead_activity:${id}:form`), tenant_id: t, lead_id: id, kind: "form", body: "Trial request from the website", at: created.toISOString(), created_at: created.toISOString() });
    if (key !== "new") activityRows.push({ id: sid(`lead_activity:${id}:call`), tenant_id: t, lead_id: id, kind: "call", body: "Called — interested in a trial for their child", by_user_id: user("frontdesk@ridgelinetkd.demo"), at: new Date(created.getTime() + 86_400_000).toISOString() });
    const session = key === "trial_scheduled" ? trialSessions[i - 4] : ["trial_attended", "offer"].includes(key) ? pastTrial : undefined;
    if (session) {
      trialBooking = sid(`booking:${T}:trial:${p.id}`);
      const attended = key !== "trial_scheduled";
      bookingRows.push({ id: trialBooking, tenant_id: t, session_id: session.id, person_id: p.id, status: attended ? "attended" : "booked", source: "trial", booked_by_user_id: user("frontdesk@ridgelinetkd.demo") });
      activityRows.push({ id: sid(`lead_activity:${id}:booked`), tenant_id: t, lead_id: id, kind: "trial_booked", body: `Booked ${session.name} on ${fmt(session.starts_at)}`, at: new Date(created.getTime() + 2 * 86_400_000).toISOString() });
      if (attended) {
        attendanceRows.push({ id: sid(`attendance:${T}:trial:${p.id}`), tenant_id: t, session_id: session.id, person_id: p.id, checked_in_at: session.starts_at.toISOString(), source: "desk", note: "Trial class" });
        activityRows.push({ id: sid(`lead_activity:${id}:attended`), tenant_id: t, lead_id: id, kind: "trial_attended", body: "Attended a class", at: session.starts_at.toISOString() });
      }
    }
    const overdue = i === 2;
    leadRows.push({
      id, tenant_id: t, person_id: p.id, stage_id: stages.get(key), source: p.source, utm: sql.json(p.utm ?? {}), trial_booking_id: trialBooking,
      program_interest: [sid(`program:${T}:${i % 3 === 2 ? "little-tigers" : "youth-tkd"}`)], owner_user_id: user("frontdesk@ridgelinetkd.demo"),
      next_action: key === "lost" ? null : key === "offer" ? "Send the enrollment offer" : ["new", "contacted"].includes(key) ? "Call to book a trial" : "Confirm the trial class",
      next_action_at: key === "lost" ? null : new Date(now.getTime() + (overdue ? -2 : rng.int(1, 4)) * 86_400_000).toISOString(),
      lost_reason: key === "lost" ? "Schedule doesn't work" : null, message: i % 2 ? "Looking for an after-school activity that builds confidence." : null,
      stage_changed_at: new Date(created.getTime() + 3 * 86_400_000).toISOString(), created_at: created.toISOString(),
    });
  });
  await insertChunks(sql, "bookings", bookingRows);
  await insertChunks(sql, "leads", leadRows);
  await insertChunks(sql, "attendance", attendanceRows);
  await insertChunks(sql, "lead_activities", activityRows);

  // ------------------------------------------------------------------ Belt test next Saturday (Youth TKD)
  const saturday = nextDow(6);
  const testId = sid(`testing_event:${T}:saturday`);
  const youth = sid(`program:${T}:youth-tkd`);
  await insertChunks(sql, "testing_events", [{
    id: testId, tenant_id: t, location_id: LOC(), name: "Saturday Belt Test", starts_at: at(saturday, "10:00"), ends_at: at(saturday, "12:30"), program_ids: [youth], fee_cents: 4500,
    registration_deadline: addDaysStr(saturday, -2), capacity: 40, judges: [user("owner@ridgelinetkd.demo"), user("instructor@ridgelinetkd.demo")], status: "open", notes: "Color belts. Arrive 20 minutes early in a clean dobok.", created_by: user("owner@ridgelinetkd.demo"),
  }]);
  // Eligible = meets every requirement of the next rank (the engine's rule, as SQL); 3 are registered and paid.
  const eligible = await sql<{ id: string; person_id: string; next_rank_id: string }[]>`
    select e.id, e.person_id, v.next_rank_id from public.enrollments e join public.v_enrollment_progress v on v.enrollment_id = e.id
    where e.tenant_id = ${t} and e.status = 'active' and e.program_id = ${youth} and v.next_rank_id is not null
      and v.classes_since_promotion >= coalesce(v.min_classes, 0) and v.days_since_promotion >= coalesce(v.min_days, 0)
      and not exists (select 1 from public.rank_skills rs where rs.rank_id = v.next_rank_id and rs.required
                      and not exists (select 1 from public.skill_signoffs so where so.enrollment_id = e.id and so.skill_id = rs.skill_id))
      and (not coalesce(v.requires_instructor_approval, false) or coalesce(v.instructor_approved, false))
    order by e.id`;
  const regRows: Record<string, unknown>[] = [];
  for (const e of eligible.filter((x) => x.person_id !== sid(`person:${T}:maya-cooper`)).slice(0, 3)) {
    const rid = sid(`testing_registration:${T}:${e.id}`);
    const hh = householdOf.get(e.person_id) ?? "";
    const invId = invoice(`testing:${e.id}`, { household: hh, person: e.person_id, total: 4500, source: "testing", memo: "Saturday Belt Test", kind: "testing", description: "Testing fee — Saturday Belt Test", refType: "testing_registration", refId: rid, issued: addDaysStr(today, -3), due: addDaysStr(saturday, -2), paidOn: addDaysStr(today, -2) });
    regRows.push({ id: rid, tenant_id: t, testing_event_id: testId, enrollment_id: e.id, person_id: e.person_id, to_rank_id: e.next_rank_id, status: "paid", eligibility_snapshot: sql.json({ status: "eligible", gaps: [] }),
      invoice_id: invId, invited_at: at(addDaysStr(today, -4), "10:00"), registered_at: at(addDaysStr(today, -3), "19:10") });
  }
  await flushMoney();
  await insertChunks(sql, "testing_registrations", regRows);

  // ------------------------------------------------------------------ Events: camp, parents' night out, ceremony, a party
  const [waiverV1] = await sql<{ id: string }[]>`select id from public.document_templates where tenant_id = ${t} and kind = 'waiver' order by version limit 1`;
  const signedV1 = new Set((await sql<{ person_id: string }[]>`select person_id from public.signatures where template_id = ${waiverV1?.id ?? null}`).map((s) => s.person_id));
  const allergies = new Map((await sql<{ id: string; allergies: string[] }[]>`select id, allergies from public.people where tenant_id = ${t} and cardinality(allergies) > 0`).map((p) => [p.id, p.allergies]));
  const eventRows: Record<string, unknown>[] = [];
  const dayRows: Record<string, unknown>[] = [];
  const eregRows: Record<string, unknown>[] = [];
  const addEvent = (key: string, e: { kind: string; name: string; description: string; dates: string[]; start: string; end: string; capacity: number | null; pricing: { label: string; price_cents: number; per: string }[]; waivers?: string[]; host?: string; deposit?: number; depositInvoice?: string }) => {
    const id = sid(`event:${T}:${key}`);
    const first = e.dates[0] ?? today;
    const last = e.dates[e.dates.length - 1] ?? today;
    eventRows.push({ id, tenant_id: t, location_id: LOC(), kind: e.kind, name: e.name, description: e.description, starts_at: at(first, e.start), ends_at: at(last, e.end), capacity: e.capacity,
      waiver_template_ids: e.waivers ?? [], pricing: sql.json(e.pricing), status: "open", registration_closes_at: at(addDaysStr(first, -1), "23:59"), host_household_id: e.host ?? null,
      deposit_cents: e.deposit ?? null, deposit_invoice_id: e.depositInvoice ?? null, created_by: user("owner@ridgelinetkd.demo"), created_at: at(addDaysStr(today, -20), "11:00") });
    const days = e.dates.map((d) => ({ id: sid(`event_day:${id}:${d}`), date: d }));
    for (const d of days) dayRows.push({ id: d.id, tenant_id: t, event_id: id, date: d.date, starts_at: at(d.date, e.start), ends_at: at(d.date, e.end) });
    return { id, days };
  };
  const register = (ev: { id: string; days: { id: string }[] }, name: string, personId: string, option: string, price: number, dayIds: string[], paid: boolean) => {
    const rid = sid(`event_registration:${ev.id}:${personId}`);
    const hh = householdOf.get(personId) ?? "";
    const invId = price > 0 ? invoice(`event:${ev.id}:${personId}`, { household: hh, person: personId, total: price, source: "event", memo: name, kind: "event", description: `${name} — ${option}`, refType: "event", refId: ev.id, issued: addDaysStr(today, -rng.int(3, 15)), due: addDaysStr(today, 10), paidOn: paid ? addDaysStr(today, -rng.int(1, 2)) : null }) : null;
    eregRows.push({ id: rid, tenant_id: t, event_id: ev.id, person_id: personId, household_id: hh, option_label: option, days: dayIds, status: paid || price === 0 ? "paid" : "registered", invoice_id: invId, allergies_ack: allergies.has(personId), registered_by: user("frontdesk@ridgelinetkd.demo") });
  };
  // Fall break camp: a Mon–Fri week three weeks out, 22 registered (full weeks and day passes).
  const campMonday = nextDow(1, 14);
  const camp = addEvent("fall-camp", { kind: "camp", name: "Fall Break Camp", description: "A week of taekwondo, games, crafts and field trips for ages 5–12. Bring a lunch and a water bottle.",
    dates: [0, 1, 2, 3, 4].map((i) => addDaysStr(campMonday, i)), start: "09:00", end: "15:00", capacity: 30,
    pricing: [{ label: "Full week", price_cents: 22500, per: "person" }, { label: "Single day", price_cents: 5500, per: "day" }], waivers: waiverV1 ? [waiverV1.id] : [] });
  const campKids = rng.sample(kids.filter((k) => k.age >= 5 && k.age <= 12 && signedV1.has(k.id) && k.id !== sid(`person:${T}:maya-cooper`) && k.id !== sid(`person:${T}:riley-adams`)), 22);
  campKids.forEach((k, i) => {
    if (i < 14) register(camp, "Fall Break Camp", k.id, "Full week", 22500, camp.days.map((d) => d.id), i < 10);
    else { const n = rng.int(2, 3); const ds = rng.sample(camp.days, n).map((d) => d.id); register(camp, "Fall Break Camp", k.id, "Single day", 5500 * n, ds, i < 19); }
  });
  // Parents' night out next Friday evening.
  const pno = addEvent("pno", { kind: "event", name: "Parents' Night Out", description: "Drop the kids off for pizza, games and a movie on the mats. Ages 5–12.", dates: [nextDow(5, 2)], start: "18:00", end: "21:00", capacity: 20,
    pricing: [{ label: "Per child", price_cents: 3500, per: "person" }] });
  rng.sample(kids.filter((k) => k.age >= 5 && k.age <= 12 && !campKids.includes(k)), 12).forEach((k, i) => register(pno, "Parents' Night Out", k.id, "Per child", 3500, pno.days.map((d) => d.id), i < 9));
  // Belt ceremony the Saturday after the test (free, families RSVP).
  addEvent("ceremony", { kind: "ceremony", name: "Belt Ceremony", description: "Congratulations to everyone promoted at the Saturday test. Families welcome.", dates: [addDaysStr(saturday, 7)], start: "11:00", end: "12:00", capacity: null,
    pricing: [{ label: "Free", price_cents: 0, per: "person" }] });
  // One birthday party booked, deposit paid, three guest waivers signed.
  const partyKid = kids.find((k) => k.age >= 7 && k.age <= 9 && k.householdId !== people.cooperHousehold) ?? kids[0];
  if (partyKid) {
    const partyDate = addDaysStr(saturday, 14);
    const first = partyKid.name.split(" ")[0] ?? "Student";
    const depositInvoice = invoice(`party-deposit:${partyKid.id}`, { household: partyKid.householdId, person: null, total: 10000, source: "event", memo: `${first}'s birthday party deposit`, kind: "event", description: `${first}'s birthday party — deposit`, refType: "event", refId: sid(`event:${T}:party`), issued: addDaysStr(today, -6), due: addDaysStr(today, 1), paidOn: addDaysStr(today, -5) });
    const party = addEvent("party", { kind: "party", name: `${first}'s birthday party`, description: "Two hours: games, a board-breaking show and cake in the lobby. Up to 15 guests.", dates: [partyDate], start: "14:00", end: "16:00", capacity: 15,
      pricing: [], host: partyKid.householdId, deposit: 10000, depositInvoice });
    await flushMoney();
    await insertChunks(sql, "events", eventRows);
    await insertChunks(sql, "event_days", dayRows);
    const guests = [["Ava Martinez", "Carla Martinez"], ["Noah Kim", "Daniel Kim"], ["Leo Carter", "Aisha Carter"]] as const;
    await insertChunks(sql, "event_guest_waivers", guests.map(([g, p], i) => ({ id: sid(`guest_waiver:${party.id}:${i}`), tenant_id: t, event_id: party.id, template_id: waiverV1?.id ?? null, guest_name: g, guardian_name: p, typed_signature: p, signed_at: at(addDaysStr(today, -i - 1), "20:15") })));
  } else {
    await flushMoney();
    await insertChunks(sql, "events", eventRows);
    await insertChunks(sql, "event_days", dayRows);
  }
  await insertChunks(sql, "event_registrations", eregRows);

  // ------------------------------------------------------------------ After-school: 18 kids, 3 schools, 2 routes, 60 days
  const planId = sid(`membership_plan:${T}:afterschool`);
  const progId = sid(`afterschool_program:${T}:club`);
  await insertChunks(sql, "membership_plans", [{ id: planId, tenant_id: t, name: "After-school: After-School Club", description: "Weekly after-school tuition", kind: "recurring", interval: "week", interval_count: 1, price_cents: 9500, public: false, tax_class: "exempt", sort: 90 }]);
  const SCHOOLS = [["Oak Elementary", "North"], ["Maple Street Elementary", "North"], ["Riverside Middle", "South"]] as const;
  await insertChunks(sql, "afterschool_programs", [{ id: progId, tenant_id: t, location_id: LOC(), name: "After-School Club", weekly_price_cents: 9500, schools: SCHOOLS.map((s) => s[0]), routes: ["North", "South"], days_of_week: [1, 2, 3, 4, 5], pickup_cutoff: "15:45", plan_id: planId }]);
  const guardianName = new Map((await sql<{ household_id: string; name: string }[]>`
    select distinct on (hm.household_id) hm.household_id, trim(p.first_name || ' ' || p.last_name) as name from public.household_members hm join public.people p on p.id = hm.person_id
    where hm.tenant_id = ${t} and hm.relationship = 'guardian' order by hm.household_id, hm.is_primary_guardian desc`).map((g) => [g.household_id, g.name]));
  let startMonday = addDaysStr(today, -91);
  while (new Date(`${startMonday}T12:00:00Z`).getUTCDay() !== 1) startMonday = addDaysStr(startMonday, -1);
  const asKids = rng.sample(kids.filter((k) => k.age >= 6 && k.age <= 11 && k.householdId !== people.cooperHousehold), 18);
  const enrRows: Record<string, unknown>[] = [];
  const memRows: Record<string, unknown>[] = [];
  const attRows: Record<string, unknown>[] = [];
  let asDays = 0;
  asKids.forEach((k, i) => {
    const [school, route] = SCHOOLS[i % 3] ?? SCHOOLS[0];
    const days = i < 14 ? [1, 2, 3, 4, 5] : i % 2 ? [2, 4] : [1, 3, 5];
    const eid = sid(`afterschool_enrollment:${T}:${k.id}`);
    const mid = sid(`membership:${T}:afterschool:${k.id}`);
    // Weekly invoices from the start Monday through this week; this week's is still open.
    let week = startMonday;
    while (week <= today) {
      const current = addDaysStr(week, 7) > today;
      invoice(`afterschool:${k.id}:${week}`, { household: k.householdId, person: k.id, total: 9500, source: "billing_run", memo: "After-School Club", kind: "membership", description: `After-School Club — week of ${week}`, refType: "membership", refId: mid,
        issued: week, due: week, paidOn: current ? null : addDaysStr(week, rng.int(0, 3)), membership: mid, periodStart: week, periodEnd: addDaysStr(week, 6) });
      week = addDaysStr(week, 7);
    }
    memRows.push({ id: mid, tenant_id: t, household_id: k.householdId, person_id: k.id, plan_id: planId, status: "active", starts_at: startMonday, next_bill_at: week, notes: "After-school: After-School Club", created_at: at(startMonday, "08:00") });
    enrRows.push({ id: eid, tenant_id: t, program_id: progId, person_id: k.id, household_id: k.householdId, school, pickup_route: route, days_of_week: days, status: "active", starts_on: startMonday, membership_id: mid, created_at: at(startMonday, "08:00") });
    // 60 days of attendance (up to yesterday): picked up at school, arrived, released to a guardian.
    for (let d = addDaysStr(today, -60); d < today; d = addDaysStr(d, 1)) {
      const iso = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (!days.includes(iso === 0 ? 7 : iso) || d < startMonday) continue;
      const aid = sid(`afterschool_attendance:${eid}:${d}`);
      asDays += 1;
      if (rng.chance(0.05)) {
        const cutoff = rng.chance(0.4);
        attRows.push({ id: aid, tenant_id: t, enrollment_id: eid, date: d, absent: true, absence_reason: cutoff ? "not at pickup by the cutoff" : rng.pick(["Parent called: sick", "Parent picked up from school", "Dentist appointment"]), alerted_at: cutoff ? at(d, "15:50") : null });
        continue;
      }
      const pick = rng.int(5, 25);
      attRows.push({ id: aid, tenant_id: t, enrollment_id: eid, date: d, picked_up_at: at(d, clock(15, pick)), arrived_at: at(d, clock(15, pick + 12)),
        released_at: at(d, clock(rng.int(17, 18), rng.int(0, 45))), released_to: guardianName.get(k.householdId) ?? "Parent", marked_by: user("frontdesk@ridgelinetkd.demo") });
    }
  });
  await insertChunks(sql, "memberships", memRows);
  await flushMoney();
  await insertChunks(sql, "afterschool_enrollments", enrRows);
  await insertChunks(sql, "afterschool_attendance", attRows);

  // ------------------------------------------------------------------ Staff: profiles, PINs, time clock, shifts
  const STAFF = [
    { email: "owner@ridgelinetkd.demo", title: "Head instructor & owner", rates: {}, programs: ["youth-tkd", "adult-tkd"] },
    { email: "instructor@ridgelinetkd.demo", title: "Senior instructor", rates: { per_class_cents: 3500 }, programs: ["youth-tkd"] },
    { email: "instructor2@ridgelinetkd.demo", title: "Instructor", rates: { per_class_cents: 3000 }, programs: ["youth-tkd", "sparring-team"] },
    { email: "instructor3@ridgelinetkd.demo", title: "Little Tigers instructor", rates: { per_class_cents: 3000 }, programs: ["little-tigers", "demo-team"] },
    { email: "instructor4@ridgelinetkd.demo", title: "Adult program instructor", rates: { per_class_cents: 3500 }, programs: ["adult-tkd"] },
    { email: "assistant@ridgelinetkd.demo", title: "Assistant instructor", rates: { hourly_cents: 1600 }, programs: ["little-tigers"] },
    { email: "frontdesk@ridgelinetkd.demo", title: "Front desk lead", rates: { hourly_cents: 1900, commission_pct: 5 }, programs: [] },
    { email: "frontdesk2@ridgelinetkd.demo", title: "Front desk", rates: { hourly_cents: 1700, commission_pct: 5 }, programs: [] },
  ];
  for (const s of STAFF) {
    // Upsert on the person, not the row id: a profile may already exist for them.
    await sql`insert into public.staff_profiles (id, tenant_id, user_id, title, pay_rates, programs, hire_date)
      values (${sid(`staff_profile:${T}:${s.email}`)}, ${t}, ${user(s.email)}, ${s.title}, ${sql.json(s.rates)}, ${s.programs.map((p) => sid(`program:${T}:${p}`))}, '2022-08-15')
      on conflict (tenant_id, user_id) do update set title = excluded.title, pay_rates = excluded.pay_rates, programs = excluded.programs, hire_date = excluded.hire_date`;
  }
  // Kiosk staff PIN 2468 for everyone (documented in DEMO-ACCOUNTS.md).
  for (const s of STAFF) {
    await sql`insert into public.staff_pins (id, tenant_id, user_id, pin_hash) values (${sid(`staff_pin:${T}:${s.email}`)}, ${t}, ${user(s.email)}, extensions.crypt('2468', extensions.gen_salt('bf', 8)))
      on conflict (tenant_id, user_id) do nothing`;
  }
  const timeRows: Record<string, unknown>[] = [];
  const shiftRows: Record<string, unknown>[] = [];
  for (const [email, weekdays] of [["frontdesk@ridgelinetkd.demo", [1, 2, 3, 4]], ["frontdesk2@ridgelinetkd.demo", [3, 4, 5, 6]], ["assistant@ridgelinetkd.demo", [2, 6]]] as const) {
    for (let d = addDaysStr(today, -45); d < today; d = addDaysStr(d, 1)) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (!(weekdays as readonly number[]).includes(wd)) continue;
      const sat = wd === 6;
      timeRows.push({ id: sid(`time_entry:${T}:${email}:${d}`), tenant_id: t, user_id: user(email), location_id: LOC(), clock_in: at(d, sat ? clock(8, rng.int(20, 35)) : clock(14, rng.int(20, 35))),
        clock_out: at(d, sat ? clock(13, rng.int(45, 59)) : clock(20, rng.int(25, 45))), source: "kiosk", approved_by: user("owner@ridgelinetkd.demo"), approved_at: at(addDaysStr(d, 1), "09:00") });
    }
    for (let d = today; d < addDaysStr(today, 14); d = addDaysStr(d, 1)) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (!(weekdays as readonly number[]).includes(wd)) continue;
      const sat = wd === 6;
      shiftRows.push({ id: sid(`shift:${T}:${email}:${d}`), tenant_id: t, user_id: user(email), location_id: LOC(), starts_at: at(d, sat ? "08:30" : "14:30"), ends_at: at(d, sat ? "14:00" : "20:30"), role_label: email.startsWith("assistant") ? "Assistant" : "Front desk" });
    }
  }
  await insertChunks(sql, "time_entries", timeRows);
  await insertChunks(sql, "shifts", shiftRows);
  // Recent POS sales rung up by the front desk earn their commission (what the trigger does live).
  await sql`update public.pos_sales set cashier_user_id = case when extract(dow from created_at) in (1, 2) then ${user("frontdesk@ridgelinetkd.demo")}::uuid else ${user("frontdesk2@ridgelinetkd.demo")}::uuid end
    where tenant_id = ${t} and created_at >= ${new Date(now.getTime() - 60 * 86_400_000)}`;
  await sql`insert into public.commissions (tenant_id, user_id, ref_type, ref_id, base_cents, rate_pct, amount_cents, period, created_at)
    select s.tenant_id, s.cashier_user_id, 'pos_sale', s.id, s.subtotal_cents - s.discount_cents, 5, round((s.subtotal_cents - s.discount_cents) * 5 / 100.0)::int, app.local_period(s.tenant_id, s.created_at), s.created_at
    from public.pos_sales s where s.tenant_id = ${t} and s.kind = 'sale' and s.status = 'completed' and s.cashier_user_id is not null
    on conflict (ref_type, ref_id) do nothing`;

  // ------------------------------------------------------------------ Automations: 8 on, with run history
  await sql`update public.automations set active = template_key not in ('absent_30', 'review_request') where tenant_id = ${t}`;
  const autos = new Map((await sql<{ template_key: string; id: string }[]>`select template_key, id from public.automations where tenant_id = ${t}`).map((a) => [a.template_key, a.id]));
  const runRows: Record<string, unknown>[] = [];
  const commRows: Record<string, unknown>[] = [];
  const recipients = new Map((await sql<{ person_id: string; recipient: string; household_id: string; first_name: string; email: string | null }[]>`
    select r.person_id, r.recipient_person_id as recipient, r.household_id, r.first_name, r.email from app.recipients_for(${t}, (select array_agg(id) from public.people where tenant_id = ${t} and 'student' = any (type_flags))) r`)
    .map((r) => [r.person_id, r]));
  const firstName = new Map(people.students.map((s) => [s.id, s.name.split(" ")[0] ?? s.name]));
  const run = (template: string, personId: string, dedupe: string, when: Date, log: { action: string; result: string }[], status: "done" | "waiting", context: Record<string, string | number>, send?: { key: string; subject: string; body: string }) => {
    const aid = autos.get(template);
    if (!aid) return;
    const id = sid(`automation_run:${aid}:${dedupe}`);
    runRows.push({ id, tenant_id: t, automation_id: aid, person_id: personId, context: sql.json(context), dedupe_key: dedupe, status, step: log.length, log: sql.json(log.map((l, i) => ({ at: when.toISOString(), step: i, ...l }))),
      resume_at: status === "waiting" ? new Date(when.getTime() + 7 * 86_400_000).toISOString() : null, created_at: when.toISOString(), updated_at: when.toISOString() });
    const r = recipients.get(personId);
    if (send && r?.email) {
      commRows.push({ id: sid(`communication:${id}`), tenant_id: t, channel: "email", person_id: r.recipient, household_id: r.household_id, to_address: r.email, template_key: send.key,
        subject: send.subject.replace("{{student_name}}", firstName.get(personId) ?? ""), body_text: send.body.replace("{{first_name}}", r.first_name).replace("{{student_name}}", firstName.get(personId) ?? ""),
        status: "unsent_no_provider", automation_run_id: id, related_type: "automation_run", related_id: id, data: sql.json({ first_name: r.first_name, about_person_id: personId }), created_at: when.toISOString() });
    }
  };
  const newMembers = await sql<{ id: string; person_id: string; created_at: Date }[]>`
    select m.id, m.person_id, m.created_at from public.memberships m join public.membership_plans p on p.id = m.plan_id
    where m.tenant_id = ${t} and p.kind in ('recurring', 'contract', 'paid_in_full') and m.starts_at >= ${addDaysStr(today, -30)} and m.plan_id <> ${planId} order by m.created_at`;
  for (const m of newMembers) {
    const days = (now.getTime() - m.created_at.getTime()) / 86_400_000;
    const done = days >= 7;
    run("welcome", m.person_id, `membership:${m.id}`, m.created_at, [
      { action: "send welcome", result: "1 recipient queued (email)" }, { action: "create_task", result: `Welcome call: ${firstName.get(m.person_id) ?? ""}` }, { action: "wait", result: "7 days" },
      ...(done ? [{ action: "send welcome_checkin", result: "1 recipient queued (email)" }] : []),
    ], done ? "done" : "waiting", { event: "membership.created", membership_id: m.id }, { key: "welcome", subject: "Welcome to Ridgeline Taekwondo!", body: "Hi {{first_name}},\n\nWelcome to Ridgeline Taekwondo! We're excited to have {{student_name}} on the mat." });
  }
  const birthdays = await sql<{ id: string; dob: string }[]>`
    select id, dob::text from public.people where tenant_id = ${t} and 'student' = any (type_flags) and status = 'active' and dob is not null
      and make_date(extract(year from ${today}::date)::int, extract(month from dob)::int, least(extract(day from dob)::int, 28)) between ${addDaysStr(today, -30)}::date and ${addDaysStr(today, -1)}::date`;
  for (const b of birthdays) {
    const day = `${today.slice(0, 4)}${b.dob.slice(4, 8)}${String(Math.min(Number(b.dob.slice(8, 10)), 28)).padStart(2, "0")}`;
    run("birthday", b.id, `birthday:${b.id}:${today.slice(0, 4)}`, new Date(at(day, "07:05")), [{ action: "send birthday", result: "1 recipient queued (email)" }], "done", { event: "birthday" },
      { key: "birthday", subject: "Happy birthday, {{student_name}}!", body: "Hi {{first_name}},\n\nEveryone at Ridgeline Taekwondo wishes {{student_name}} a very happy birthday!" });
  }
  const absent = await sql<{ person_id: string; last_date: string }[]>`
    select a.person_id, max((s.starts_at at time zone ${tz})::date)::text as last_date from public.attendance a join public.class_sessions s on s.id = a.session_id
    join public.people p on p.id = a.person_id where a.tenant_id = ${t} and p.status = 'active' and s.starts_at <= ${now}
    group by a.person_id having max((s.starts_at at time zone ${tz})::date) between ${addDaysStr(today, -20)}::date and ${addDaysStr(today, -8)}::date`;
  for (const a of absent.slice(0, 12)) {
    run("absent_7", a.person_id, `absence:7:${a.person_id}:${a.last_date}`, new Date(at(addDaysStr(a.last_date, 7), "07:10")), [{ action: "send absent_7", result: "1 recipient queued (email)" }], "done", { event: "absence", days: 7, last_attended: a.last_date },
      { key: "absent_7", subject: "We miss {{student_name}}!", body: "Hi {{first_name}},\n\nWe haven't seen {{student_name}} on the mat this week — we miss them!" });
  }
  const failed = await sql<{ id: string; person_id: string | null; due_at: string }[]>`
    select i.id, i.person_id, i.due_at::text from public.invoices i where i.tenant_id = ${t} and i.dunning_state ? 'failed_on' and i.status in ('open', 'past_due') and i.person_id is not null`;
  for (const f of failed) {
    run("failed_payment", f.person_id ?? "", `payment:${f.id}`, new Date(at(f.due_at, "06:30")), [{ action: "create_task", result: "Follow up on a failed payment" }], "done", { event: "payment.failed", invoice_id: f.id });
  }
  const trialLead = leadRows.find((l) => l.stage_id === stages.get("trial_attended"));
  if (trialLead && pastTrial) {
    run("trial_followup", String(trialLead.person_id), `lead:${String(trialLead.id)}:trial_attended`, pastTrial.starts_at, [{ action: "send trial_followup", result: "1 recipient queued (email)" }, { action: "create_task", result: "Offer call" }], "done", { event: "lead.stage_changed", stage: "trial_attended" });
  }
  await insertChunks(sql, "automation_runs", runRows);
  await insertChunks(sql, "communications", commRows);
  await sql`update public.automations a set runs = x.n, last_run_at = x.last from (select automation_id, count(*)::int as n, max(created_at) as last from public.automation_runs where tenant_id = ${t} group by automation_id) x where x.automation_id = a.id`;

  // ------------------------------------------------------------------ Broadcasts: two sent through the Outbox
  const BROADCASTS = [
    { key: "camp", name: "Fall Break Camp registration is open", days: 5, segment: { statuses: ["active"], age_max: 12 }, subject: "Fall Break Camp registration is open", body: "Hi {{first_name}},\n\nFall Break Camp runs Monday to Friday during the school break: taekwondo, games, crafts and a field trip. Full week or single days — register in the app under Events.\n\n— Ridgeline Taekwondo" },
    { key: "labor-day", name: "Closed for Labor Day", days: 22, segment: { statuses: ["active"] }, subject: "We're closed Monday for Labor Day", body: "Hi {{first_name}},\n\nA reminder that the school is closed on Monday for Labor Day. Classes resume Tuesday on the normal schedule. Enjoy the long weekend!\n\n— Ridgeline Taekwondo" },
  ];
  let broadcastMessages = 0;
  for (const b of BROADCASTS) {
    const cid = sid(`campaign:${T}:${b.key}`);
    const sentAt = new Date(at(addDaysStr(today, -b.days), "10:00"));
    const [already] = await sql<{ sent: boolean }[]>`select sent_at is not null as sent from public.campaigns where id = ${cid}`;
    if (already?.sent) continue;
    await insertChunks(sql, "campaigns", [{ id: cid, tenant_id: t, name: b.name, channel: "email", segment: sql.json(b.segment), subject: b.subject, body: b.body, created_by: user("owner@ridgelinetkd.demo"), created_at: new Date(sentAt.getTime() - 3_600_000).toISOString() }]);
    const [ins] = await sql<{ n: number }[]>`
      with ins as (
        insert into public.communications (tenant_id, channel, person_id, household_id, to_address, status, subject, body_text, data, related_type, related_id, campaign_id, created_by, created_at)
        select ${t}, 'email', r.recipient_person_id, r.household_id, r.address, 'unsent_no_provider', replace(${b.subject}, '{{first_name}}', r.first_name), replace(${b.body}, '{{first_name}}', r.first_name),
               jsonb_build_object('about_person_id', r.about_person_id, 'first_name', r.first_name), 'campaign', ${cid}, ${cid}, ${user("owner@ridgelinetkd.demo")}, ${sentAt}
        from app.segment_recipients(${t}, ${sql.json(b.segment)}, 'email') r where r.consent and r.address is not null
        returning 1)
      select count(*)::int as n from ins`;
    const [excluded] = await sql<{ nc: number }[]>`select count(*)::int as nc from app.segment_recipients(${t}, ${sql.json(b.segment)}, 'email') where not consent and address is not null`;
    const n = ins?.n ?? 0;
    await sql`update public.campaigns set sent_at = ${sentAt}, stats = ${sql.json({ queued: n, no_consent: excluded?.nc ?? 0 })} where id = ${cid}`;
    broadcastMessages += n;
  }

  await flushMoney();
  await sql`insert into public.tenant_counters (tenant_id, name, value) values (${t}, 'invoice', ${invoiceNo}) on conflict (tenant_id, name) do update set value = greatest(public.tenant_counters.value, excluded.value)`;

  return { leads: leadRows.length, events: eventRows.length, eventRegistrations: eregRows.length, afterschoolKids: asKids.length, afterschoolDays: asDays, automationRuns: runRows.length, broadcastMessages };
}
