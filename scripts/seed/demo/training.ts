import { addDays, expandTemplate, localDate, planSessions, weeklyRule, type WeekdayCode } from "@koryo/scheduling";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import type { DemoProgram } from "./curriculum";
import type { DemoStudent } from "./people";
import { DAY, insertChunks, type Rng } from "./rng";

const T = "ridgeline";
const TZ = "America/New_York";
const tid = () => sid(`tenant:${T}`);
const LOC = () => sid(`location:${T}:main`);
const user = (email: string) => sid(`user:${email}`);

interface TemplateDef { key: string; name: string; program: string; days: WeekdayCode[]; time: string; minutes: number; rankMin?: number; rankMax?: number; capacity: number; instructors: string[]; room: string; bookable?: boolean; band?: string }

const I1 = "instructor@ridgelinetkd.demo";
const I2 = "instructor2@ridgelinetkd.demo";
const I3 = "instructor3@ridgelinetkd.demo";
const I4 = "instructor4@ridgelinetkd.demo";
const OWNER = "owner@ridgelinetkd.demo";

// 28 weekly templates, Mon–Sat. Bands let students move to the right class as they promote.
const TEMPLATES: TemplateDef[] = [
  { key: "lt-mw", name: "Little Tigers", program: "little-tigers", days: ["MO", "WE"], time: "16:00", minutes: 40, capacity: 14, instructors: [I3], room: "Studio B", band: "lt-A" },
  { key: "lt-tt", name: "Little Tigers", program: "little-tigers", days: ["TU", "TH"], time: "16:00", minutes: 40, capacity: 14, instructors: [I3], room: "Studio B", band: "lt-B" },
  { key: "lt-sat", name: "Little Tigers (Saturday)", program: "little-tigers", days: ["SA"], time: "09:00", minutes: 40, capacity: 16, instructors: [I3], room: "Studio B", band: "lt-S" },
  { key: "yb-mw", name: "Youth Taekwondo — Beginners", program: "youth-tkd", days: ["MO", "WE"], time: "16:45", minutes: 50, rankMax: 3, capacity: 20, instructors: [I1], room: "Main mat", band: "y1-A", bookable: true },
  { key: "yb-tt", name: "Youth Taekwondo — Beginners", program: "youth-tkd", days: ["TU", "TH"], time: "16:45", minutes: 50, rankMax: 3, capacity: 20, instructors: [I2], room: "Main mat", band: "y1-B", bookable: true },
  { key: "yi-mw", name: "Youth Taekwondo — Intermediate", program: "youth-tkd", days: ["MO", "WE"], time: "17:45", minutes: 55, rankMin: 4, rankMax: 6, capacity: 16, instructors: [I1], room: "Main mat", band: "y2-A", bookable: true },
  { key: "yi-tt", name: "Youth Taekwondo — Intermediate", program: "youth-tkd", days: ["TU", "TH"], time: "17:45", minutes: 55, rankMin: 4, rankMax: 6, capacity: 16, instructors: [I2], room: "Main mat", band: "y2-B", bookable: true },
  { key: "ya-mth", name: "Youth Taekwondo — Advanced", program: "youth-tkd", days: ["MO", "TH"], time: "18:45", minutes: 60, rankMin: 7, capacity: 16, instructors: [OWNER], room: "Main mat", band: "y3-A", bookable: true },
  { key: "ya-w", name: "Youth Taekwondo — Advanced", program: "youth-tkd", days: ["WE"], time: "18:45", minutes: 60, rankMin: 7, capacity: 16, instructors: [I1], room: "Main mat", band: "y3-B", bookable: true },
  { key: "y-sat", name: "Youth Taekwondo (Saturday)", program: "youth-tkd", days: ["SA"], time: "10:00", minutes: 60, capacity: 24, instructors: [I1, I2], room: "Main mat", band: "y-S" },
  { key: "y-fri", name: "Youth Forms Clinic", program: "youth-tkd", days: ["FR"], time: "16:30", minutes: 45, capacity: 18, instructors: [I2], room: "Studio B", band: "y-F" },
  { key: "ab-mw", name: "Adult Taekwondo — Foundations", program: "adult-tkd", days: ["MO", "WE"], time: "19:30", minutes: 60, rankMax: 5, capacity: 20, instructors: [I4], room: "Main mat", band: "a1-A", bookable: true },
  { key: "ab-tt", name: "Adult Taekwondo — Foundations", program: "adult-tkd", days: ["TU", "TH"], time: "19:30", minutes: 60, rankMax: 5, capacity: 20, instructors: [I4], room: "Main mat", band: "a1-B", bookable: true },
  { key: "aa-mw", name: "Adult Taekwondo — Advanced", program: "adult-tkd", days: ["MO", "WE"], time: "20:35", minutes: 60, rankMin: 6, capacity: 18, instructors: [OWNER], room: "Main mat", band: "a2-A", bookable: true },
  { key: "aa-tt", name: "Adult Taekwondo — Advanced", program: "adult-tkd", days: ["TU", "TH"], time: "20:35", minutes: 60, rankMin: 6, capacity: 18, instructors: [I4], room: "Main mat", band: "a2-B", bookable: true },
  { key: "a-am-tu", name: "Adult Morning Class", program: "adult-tkd", days: ["TU"], time: "06:30", minutes: 50, capacity: 12, instructors: [OWNER], room: "Main mat", band: "a-M" },
  { key: "a-am-th", name: "Adult Morning Class", program: "adult-tkd", days: ["TH"], time: "06:30", minutes: 50, capacity: 12, instructors: [OWNER], room: "Main mat", band: "a-M2" },
  { key: "a-sat", name: "Adult Taekwondo (Saturday)", program: "adult-tkd", days: ["SA"], time: "11:15", minutes: 60, capacity: 24, instructors: [I4], room: "Main mat", band: "a-S" },
  { key: "a-fri-open", name: "Open Mat", program: "adult-tkd", days: ["FR"], time: "18:30", minutes: 90, capacity: 24, instructors: [I4], room: "Main mat", band: "a-O" },
  { key: "teen-fri", name: "Teen Conditioning", program: "adult-tkd", days: ["FR"], time: "17:30", minutes: 45, capacity: 16, instructors: [I1], room: "Studio B", band: "t-F" },
  { key: "spar-tu", name: "Sparring Team", program: "sparring-team", days: ["TU"], time: "18:45", minutes: 75, capacity: 20, instructors: [I2], room: "Studio B" },
  { key: "spar-fri", name: "Sparring Team", program: "sparring-team", days: ["FR"], time: "17:00", minutes: 75, capacity: 20, instructors: [I2], room: "Main mat" },
  { key: "spar-sat", name: "Sparring Team (Saturday)", program: "sparring-team", days: ["SA"], time: "12:30", minutes: 60, capacity: 20, instructors: [I2], room: "Studio B" },
  { key: "demo-we", name: "Demo Team", program: "demo-team", days: ["WE"], time: "18:45", minutes: 60, capacity: 16, instructors: [I3], room: "Studio B" },
  { key: "demo-sat", name: "Demo Team (Saturday)", program: "demo-team", days: ["SA"], time: "13:45", minutes: 75, capacity: 16, instructors: [I3], room: "Main mat" },
  { key: "tigers-fri", name: "Little Tigers Fun Friday", program: "little-tigers", days: ["FR"], time: "15:45", minutes: 40, capacity: 14, instructors: [I3], room: "Studio B", band: "lt-F" },
  { key: "yb-sat2", name: "Youth Beginners Saturday", program: "youth-tkd", days: ["SA"], time: "08:45", minutes: 45, rankMax: 3, capacity: 20, instructors: [I2], room: "Studio B", band: "y1-S" },
  { key: "a-lunch-mo", name: "Adult Lunch Express", program: "adult-tkd", days: ["MO"], time: "12:00", minutes: 45, capacity: 12, instructors: [OWNER], room: "Main mat", band: "a-L" },
];

function holidays(fromYear: number, toYear: number): { date: string; name: string }[] {
  const out: { date: string; name: string }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ date: `${y}-01-01`, name: "New Year's Day" }, { date: `${y}-07-04`, name: "Independence Day" }, { date: `${y}-12-24`, name: "Christmas Eve" }, { date: `${y}-12-25`, name: "Christmas Day" });
    const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay();
    const thanksgiving = 1 + ((4 - nov1 + 7) % 7) + 21;
    out.push({ date: `${y}-11-${String(thanksgiving).padStart(2, "0")}`, name: "Thanksgiving" });
  }
  return out;
}

interface Session { id: string; key: string; startsAt: Date; endsAt: Date; date: string }

export async function seedTraining(ctx: SeedContext, rng: Rng, now: Date, programs: DemoProgram[], students: DemoStudent[]): Promise<{ sessions: number; attendance: number; promotions: number }> {
  const today = localDate(now, TZ);
  const from = addDays(today, -730);
  const to = addDays(today, 90);
  const year = Number(today.slice(0, 4));
  const hol = holidays(year - 2, year + 1).filter((h) => h.date >= from && h.date <= to);
  await insertChunks(ctx.sql, "holidays", hol.map((h) => ({ id: sid(`holiday:${T}:${h.date}`), tenant_id: tid(), date: h.date, name: h.name })));
  const holidaySet = new Set(hol.map((h) => h.date));
  const programId = (k: string) => sid(`program:${T}:${k}`);

  await insertChunks(ctx.sql, "class_templates", TEMPLATES.map((t) => ({
    id: sid(`template:${T}:${t.key}`), tenant_id: tid(), location_id: LOC(), name: t.name, program_ids: [programId(t.program)],
    rank_min_position: t.rankMin ?? null, rank_max_position: t.rankMax ?? null, capacity: t.capacity, duration_min: t.minutes,
    rrule: weeklyRule(t.days), start_date: from, start_time: t.time, room: t.room, instructor_ids: t.instructors.map(user),
    bookable: Boolean(t.bookable), cancellation_window_min: 120, active: true,
  })));

  const sessionsByTemplate = new Map<string, Session[]>();
  const sessionRows: Record<string, unknown>[] = [];
  for (const t of TEMPLATES) {
    const rule = { rrule: weeklyRule(t.days), startDate: from, startTime: t.time, untilDate: null, durationMin: t.minutes, timeZone: TZ };
    const planned = planSessions(rule, expandTemplate(rule, from, to), [], holidaySet);
    const list: Session[] = [];
    for (const p of planned) {
      const id = sid(`session:${T}:${t.key}:${p.date}`);
      list.push({ id, key: t.key, startsAt: p.startsAt, endsAt: p.endsAt, date: p.date });
      sessionRows.push({
        id, tenant_id: tid(), template_id: sid(`template:${T}:${t.key}`), location_id: LOC(), name: t.name, program_ids: [programId(t.program)],
        occurrence_date: p.date, starts_at: p.startsAt.toISOString(), ends_at: p.endsAt.toISOString(),
        status: p.endsAt < now ? "completed" : "scheduled", instructor_ids: t.instructors.map(user), capacity: t.capacity, room: t.room,
        bookable: Boolean(t.bookable), cancellation_window_min: 120,
        lesson_plan_id: t.program === "youth-tkd" ? sid(`lesson:${T}:youth-standard`) : t.program === "little-tigers" ? sid(`lesson:${T}:tigers-standard`) : null,
      });
    }
    sessionsByTemplate.set(t.key, list);
  }
  await insertChunks(ctx.sql, "class_sessions", sessionRows);

  // ---- Enrollments, attendance, promotions (simulated chronologically per student) ----
  const prog = new Map(programs.map((p) => [p.key, p]));
  const enrollments: Record<string, unknown>[] = [];
  const attendance: Record<string, unknown>[] = [];
  const promotions: Record<string, unknown>[] = [];
  const stripes: Record<string, unknown>[] = [];
  const signoffs: Record<string, unknown>[] = [];
  const bandTemplates = (programKey: string, position: number): TemplateDef[] =>
    TEMPLATES.filter((t) => t.program === programKey && t.band && (t.rankMin ?? 1) <= position && position <= (t.rankMax ?? 99));

  const primaryProgram = (s: DemoStudent) => (s.age <= 6 ? "little-tigers" : s.age <= 12 ? "youth-tkd" : "adult-tkd");
  const teamMembers = new Set<string>();

  const simulate = (s: DemoStudent, programKey: string, startPosition: number) => {
    const p = prog.get(programKey);
    if (!p) return;
    const enrollmentId = sid(`enrollment:${s.id}:${programKey}`);
    let position = startPosition;
    let lastPromo: Date = s.start;
    let classesSince = 0;
    const slot = rng.chance(0.5) ? "A" : "B";
    const extraSat = rng.chance(0.35);
    // Some students also have a regular extra class (morning, lunch, open mat, Friday clinic).
    const extraBand = programKey === "adult-tkd" ? (rng.chance(0.45) ? rng.pick(["-M", "-M2", "-L", "-O", "-F"]) : null) : rng.chance(0.3) ? "-F" : null;
    const until = s.end && s.end < now ? s.end : now;
    const tenure = Math.max(1, until.getTime() - s.start.getTime());
    const band = () => bandTemplates(programKey, position);
    // Iterate day by day over this student's candidate sessions.
    const templatesForPos = () => {
      const ts = band();
      const main = ts.filter((t) => t.band?.endsWith(`-${slot}`));
      const sat = extraSat ? ts.filter((t) => t.band?.endsWith("-S")) : [];
      const extra = extraBand ? ts.filter((t) => t.band?.endsWith(extraBand)) : [];
      return [...(main.length ? main : ts.slice(0, 1)), ...sat, ...extra];
    };
    const teamProgram = p.inviteOnly;
    const candidates = teamProgram
      ? TEMPLATES.filter((t) => t.program === programKey).flatMap((t) => sessionsByTemplate.get(t.key) ?? [])
      : [];
    const sessionsInRange = (keys: string[]) => keys.flatMap((k) => (sessionsByTemplate.get(k) ?? []).filter((x) => x.startsAt >= s.start && x.endsAt <= until));
    let pool = teamProgram ? candidates.filter((x) => x.startsAt >= s.start && x.endsAt <= until) : sessionsInRange(templatesForPos().map((t) => t.key));
    pool.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    let i = 0;
    while (i < pool.length) {
      const sess = pool[i] as Session;
      i++;
      const t = sess.startsAt.getTime();
      const frac = (t - s.start.getTime()) / tenure;
      const decayStart = now.getTime() - 56 * DAY;
      const pAttend = s.profile === "steady" ? 0.72 : s.profile === "improving" ? 0.3 + 0.55 * frac : s.profile === "decaying" ? (t < decayStart ? 0.78 : 0.28) : s.profile === "sporadic" ? 0.3 : 0.8;
      if (!rng.chance(teamProgram ? pAttend * 0.8 : pAttend)) continue;
      attendance.push({
        id: sid(`attendance:${sess.id}:${s.id}`), tenant_id: tid(), session_id: sess.id, person_id: s.id,
        checked_in_at: new Date(t - rng.int(0, 12) * 60_000).toISOString(),
        source: rng.weighted([["kiosk", 45], ["mat", 40], ["desk", 15]] as const),
      });
      classesSince++;
      if (teamProgram) continue;
      const next = p.ranks[position];
      if (!next) continue;
      const days = (t - lastPromo.getTime()) / DAY;
      const isSat = new Date(t).getUTCDay() === 6;
      if (classesSince >= next.minClasses && days >= next.minDays && (isSat || rng.chance(0.15)) && rng.chance(0.5)) {
        const promoAt = new Date(t + 2 * 3600_000);
        for (const skill of next.skillIds) {
          signoffs.push({ id: sid(`signoff:${enrollmentId}:${skill}`), tenant_id: tid(), enrollment_id: enrollmentId, skill_id: skill, signed_off_at: new Date(promoAt.getTime() - rng.int(3, 40) * DAY).toISOString(), by_user_id: user(I1), source: "manual" });
        }
        promotions.push({ id: sid(`promotion:${enrollmentId}:${next.position}`), tenant_id: tid(), enrollment_id: enrollmentId, from_rank_id: p.ranks[position - 1]?.id ?? null, to_rank_id: next.id, promoted_at: promoAt.toISOString(), promoted_by_user_id: user(OWNER), reason: "Belt test" });
        position++;
        lastPromo = promoAt;
        classesSince = 0;
        // Re-plan remaining sessions for the new rank band.
        const remaining = sessionsInRange(templatesForPos().map((x) => x.key)).filter((x) => x.startsAt.getTime() > t).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        pool = remaining;
        i = 0;
      }
    }
    const current = p.ranks[position - 1];
    const stripesNow = current ? Math.min(Math.max(0, current.stripesMax - 1), Math.floor(classesSince / 6)) : 0;
    for (let k = 1; k <= stripesNow; k++) {
      stripes.push({ id: sid(`stripe:${enrollmentId}:${position}:${k}`), tenant_id: tid(), enrollment_id: enrollmentId, rank_id: current?.id ?? null, awarded_at: new Date(lastPromo.getTime() + k * 14 * DAY).toISOString(), awarded_by_user_id: user(I1) });
    }
    const upcoming = p.ranks[position];
    if (upcoming && !teamProgram) {
      const share = Math.min(1, classesSince / Math.max(1, upcoming.minClasses));
      for (const skill of upcoming.skillIds) {
        if (rng.chance(share * 0.85)) signoffs.push({ id: sid(`signoff:${enrollmentId}:${skill}`), tenant_id: tid(), enrollment_id: enrollmentId, skill_id: skill, signed_off_at: new Date(now.getTime() - rng.int(1, 40) * DAY).toISOString(), by_user_id: user(rng.pick([I1, I2, I4])), source: "manual" });
      }
    }
    enrollments.push({
      id: enrollmentId, tenant_id: tid(), person_id: s.id, program_id: p.id, current_rank_id: current?.id ?? null, stripes: stripesNow,
      started_at: s.start.toISOString().slice(0, 10), last_promoted_at: promotions.some((x) => x.enrollment_id === enrollmentId) ? lastPromo.toISOString() : null,
      status: s.status === "alumni" || s.status === "cancelled" ? "ended" : s.status === "on_hold" ? "paused" : "active",
    });
  };

  for (const s of students) simulate(s, primaryProgram(s), 1);

  // Invite-only teams: experienced active students.
  const byEnrollment = new Map(enrollments.map((e) => [e.person_id as string, e]));
  const rankPos = (e: Record<string, unknown> | undefined) => programs.flatMap((p) => p.ranks).find((r) => r.id === e?.current_rank_id)?.position ?? 1;
  const eligibleTeam = students.filter((s) => s.status === "active" && s.age >= 9 && rankPos(byEnrollment.get(s.id)) >= 5);
  for (const s of rng.sample(eligibleTeam, 22)) { teamMembers.add(s.id); simulate({ ...s, start: new Date(Math.max(s.start.getTime(), now.getTime() - 500 * DAY)) }, "sparring-team", 1); }
  for (const s of rng.sample(eligibleTeam.filter((x) => !teamMembers.has(x.id)), 14)) simulate({ ...s, start: new Date(Math.max(s.start.getTime(), now.getTime() - 400 * DAY)) }, "demo-team", 1);

  await insertChunks(ctx.sql, "enrollments", enrollments);
  await insertChunks(ctx.sql, "promotions", promotions);
  await insertChunks(ctx.sql, "stripe_awards", stripes);
  await insertChunks(ctx.sql, "skill_signoffs", signoffs);
  await insertChunks(ctx.sql, "attendance", attendance, 2000);

  // Tonight's (or the next) Youth Beginners session: full with a waitlist, for the demo roster.
  const nextYouth = [...(sessionsByTemplate.get("yb-mw") ?? []), ...(sessionsByTemplate.get("yb-tt") ?? [])]
    .filter((x) => x.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  if (nextYouth) {
    const pool = students.filter((s) => s.status === "active" && s.age >= 7 && s.age <= 12 && rankPos(byEnrollment.get(s.id)) <= 3);
    const cooperFirst = pool.filter((s) => s.name === "Maya Cooper" || s.name === "Leo Cooper");
    const chosen = [...cooperFirst, ...rng.sample(pool.filter((s) => !cooperFirst.includes(s)), 22)].slice(0, 22);
    await insertChunks(ctx.sql, "bookings", chosen.map((s, idx) => ({
      id: sid(`booking:${nextYouth.id}:${s.id}`), tenant_id: tid(), session_id: nextYouth.id, person_id: s.id,
      status: idx < 20 ? "booked" : "waitlisted", waitlist_position: idx < 20 ? null : idx - 19, source: idx % 2 ? "home" : "desk",
    })));
  }
  return { sessions: sessionRows.length, attendance: attendance.length, promotions: promotions.length };
}
