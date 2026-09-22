import { Faker, base, en } from "@faker-js/faker";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import { DAY, insertChunks, isoDate, type Rng } from "./rng";

const T = "ridgeline";
const tid = () => sid(`tenant:${T}`);

export type Profile = "steady" | "improving" | "decaying" | "sporadic" | "new";

export interface DemoStudent {
  id: string;
  name: string;
  age: number;
  householdId: string;
  status: "active" | "trial" | "on_hold" | "cancelled" | "alumni";
  profile: Profile;
  start: Date;
  /** Last day they trained (alumni/cancelled/on hold); null = still training. */
  end: Date | null;
  minor: boolean;
}

export interface DemoPeople {
  students: DemoStudent[];
  householdIds: string[];
  guardianIds: string[];
  cooperHousehold: string;
}

interface PersonRow { [k: string]: unknown }

function ageToDob(rng: Rng, now: Date, age: number): string {
  const d = new Date(now.getTime() - (age * 365.25 + rng.int(10, 350)) * DAY);
  return isoDate(d);
}

export async function seedPeople(ctx: SeedContext, rng: Rng, now: Date): Promise<DemoPeople> {
  const faker = new Faker({ locale: [en, base] });
  faker.seed(20260922);
  const people: PersonRow[] = [];
  const households: PersonRow[] = [];
  const members: PersonRow[] = [];
  const consents: PersonRow[] = [];
  const notes: PersonRow[] = [];
  const students: DemoStudent[] = [];
  const guardianIds: string[] = [];
  const householdIds: string[] = [];
  const location = sid(`location:${T}:main`);
  let n = 0;

  const profileFor = (): Profile => rng.weighted([["steady", 55], ["improving", 15], ["decaying", 12], ["sporadic", 13], ["new", 5]] as const);
  const statusFor = (): DemoStudent["status"] => rng.weighted([["active", 88], ["on_hold", 6], ["alumni", 5], ["trial", 2]] as const);

  const addStudent = (householdId: string, first: string, last: string, age: number, extra: Partial<PersonRow> = {}, forcedStatus?: DemoStudent["status"]): DemoStudent => {
    const key = `demo-${++n}`;
    const id = sid(`person:${T}:${key}`);
    const status = forcedStatus ?? statusFor();
    const profile = status === "trial" ? "new" : profileFor();
    const tenureDays = profile === "new" || status === "trial" ? rng.int(10, 70) : rng.int(120, Math.min(age * 250, 2000));
    const start = new Date(now.getTime() - tenureDays * DAY);
    const end = status === "alumni" || status === "cancelled" ? new Date(now.getTime() - rng.int(60, 400) * DAY) : status === "on_hold" ? new Date(now.getTime() - rng.int(20, 90) * DAY) : null;
    const minor = age < 18;
    people.push({
      id, tenant_id: tid(), type_flags: ["student"], first_name: first, last_name: last, dob: ageToDob(rng, now, age),
      email: minor ? null : faker.internet.email({ firstName: first, lastName: last, provider: "example.test" }).toLowerCase(),
      phone: minor ? null : faker.phone.number({ style: "national" }), email_consent: !minor, phone_sms_consent: !minor && rng.chance(0.7),
      allergies: minor && rng.chance(0.08) ? [rng.pick(["peanuts", "tree nuts", "bee stings", "latex", "shellfish"])] : [],
      injury_flags: rng.chance(0.03) ? [rng.pick(["left knee", "right shoulder", "lower back", "ankle"])] : [],
      status, status_changed_at: (end ?? start).toISOString(), primary_location_id: location, source: rng.pick(["walk-in", "referral", "website", "google", "event"]),
      uniform_size: minor ? rng.pick(["000", "00", "0", "1", "2"]) : rng.pick(["3", "4", "5", "6"]), created_at: start.toISOString(), ...extra,
    });
    const s: DemoStudent = { id, name: `${first} ${last}`, age, householdId, status, profile, start, end, minor };
    students.push(s);
    if (minor) {
      for (const [kind, p] of [["media_release", 0.8], ["ai_processing", 0.75], ["messaging", 0.9]] as const) {
        consents.push({ id: sid(`consent:${id}:${kind}`), tenant_id: tid(), person_id: id, kind, granted: rng.chance(p), method: rng.pick(["desk", "paper", "home"]), granted_at: start.toISOString() });
      }
    }
    return s;
  };

  const addGuardian = (householdId: string, first: string, last: string, primary: boolean, trains: boolean): string => {
    const key = `demo-${++n}`;
    const id = sid(`person:${T}:${key}`);
    people.push({
      id, tenant_id: tid(), type_flags: trains ? ["guardian", "student"] : ["guardian"], first_name: first, last_name: last,
      dob: ageToDob(rng, now, rng.int(28, 52)), email: faker.internet.email({ firstName: first, lastName: last, provider: "example.test" }).toLowerCase(),
      phone: faker.phone.number({ style: "national" }), email_consent: rng.chance(0.93), phone_sms_consent: rng.chance(0.72),
      status: trains ? "active" : "guardian_only", primary_location_id: location, created_at: new Date(now.getTime() - rng.int(100, 1500) * DAY).toISOString(),
    });
    members.push({ id: sid(`hm:${householdId}:${id}`), tenant_id: tid(), household_id: householdId, person_id: id, relationship: "guardian", is_primary_guardian: primary, can_pickup: true, receives_billing: primary });
    guardianIds.push(id);
    if (trains) {
      const start = new Date(now.getTime() - rng.int(150, 900) * DAY);
      students.push({ id, name: `${first} ${last}`, age: 40, householdId, status: "active", profile: profileFor(), start, end: null, minor: false });
    }
    return id;
  };

  const newHousehold = (key: string, name: string): string => {
    const id = sid(`household:${T}:${key}`);
    households.push({ id, tenant_id: tid(), name, created_at: new Date(now.getTime() - rng.int(100, 1500) * DAY).toISOString() });
    householdIds.push(id);
    return id;
  };

  const kidAge = () => rng.weighted([[rng.int(4, 6), 30], [rng.int(7, 12), 55], [rng.int(13, 17), 15]] as const);

  // 90 families with children (40 × 1 kid, 30 × 2, 20 × 3), 1–2 guardians, some guardians train.
  const families: { hid: string; last: string; kids: DemoStudent[] }[] = [];
  const kidCounts = [...Array(40).fill(1), ...Array(30).fill(2), ...Array(20).fill(3)] as number[];
  kidCounts.forEach((k, i) => {
    const last = faker.person.lastName();
    const hid = newHousehold(`family-${i}`, `${last} family`);
    const g1 = faker.person.firstName();
    const g1id = addGuardian(hid, g1, last, true, rng.chance(0.1));
    if (rng.chance(0.65)) addGuardian(hid, faker.person.firstName(), rng.chance(0.85) ? last : faker.person.lastName(), false, rng.chance(0.05));
    const kids: DemoStudent[] = [];
    for (let j = 0; j < k; j++) {
      const s = addStudent(hid, faker.person.firstName(), last, kidAge());
      members.push({ id: sid(`hm:${hid}:${s.id}`), tenant_id: tid(), household_id: hid, person_id: s.id, relationship: "student", is_primary_guardian: false, can_pickup: false, receives_billing: false });
      kids.push(s);
    }
    households[households.length - 1]!.primary_payer_person_id = g1id;
    households[households.length - 1]!.billing_email = people.find((p) => p.id === g1id)?.email ?? null;
    families.push({ hid, last, kids });
  });

  // 8 split households: a child also belongs to the other parent's household.
  families.filter((f) => f.kids.length > 0).slice(0, 8).forEach((f, i) => {
    const otherLast = faker.person.lastName();
    const hid = newHousehold(`split-${i}`, `${otherLast} household`);
    const gid = addGuardian(hid, faker.person.firstName(), otherLast, true, false);
    households[households.length - 1]!.primary_payer_person_id = gid;
    const kid = f.kids[0] as DemoStudent;
    members.push({ id: sid(`hm:${hid}:${kid.id}`), tenant_id: tid(), household_id: hid, person_id: kid.id, relationship: "student", is_primary_guardian: false, can_pickup: false, receives_billing: false });
  });

  // 30 adult households (18 singles, 12 couples who both train).
  for (let i = 0; i < 30; i++) {
    const last = faker.person.lastName();
    const hid = newHousehold(`adult-${i}`, i < 18 ? `${last}` : `${last} household`);
    const count = i < 18 ? 1 : 2;
    for (let j = 0; j < count; j++) {
      const s = addStudent(hid, faker.person.firstName(), last, rng.int(18, 55));
      members.push({ id: sid(`hm:${hid}:${s.id}`), tenant_id: tid(), household_id: hid, person_id: s.id, relationship: "student", is_primary_guardian: j === 0, can_pickup: true, receives_billing: j === 0 });
      if (j === 0) households[households.length - 1]!.primary_payer_person_id = s.id;
    }
  }

  // 9 leads (no household yet — the CRM pipeline lands in M3).
  for (let i = 0; i < 9; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    people.push({
      id: sid(`person:${T}:lead-${i}`), tenant_id: tid(), type_flags: ["lead"], first_name: first, last_name: last,
      email: faker.internet.email({ firstName: first, lastName: last, provider: "example.test" }).toLowerCase(), phone: faker.phone.number({ style: "national" }),
      email_consent: true, status: "lead", source: rng.pick(["website", "google", "facebook", "referral"]),
      utm: ctx.sql.json({ source: rng.pick(["google", "facebook", "instagram"]), medium: rng.pick(["cpc", "social"]), campaign: "fall-trial" }),
      primary_location_id: location, created_at: new Date(now.getTime() - rng.int(1, 30) * DAY).toISOString(),
    });
  }

  // A few staff-visible notes for context (injuries, progress).
  for (const s of rng.sample(students.filter((x) => x.status === "active"), 25)) {
    notes.push({
      id: sid(`note:${s.id}`), tenant_id: tid(), person_id: s.id, kind: rng.pick(["progress", "injury", "behavior", "general"]),
      body: rng.pick(["Great focus in forms this week.", "Mentioned a sore ankle — modify jumping kicks.", "Needs reminders about sparring control.", "Parent asked about testing timeline.", "Big improvement on roundhouse chamber."]),
      created_at: new Date(now.getTime() - rng.int(3, 60) * DAY).toISOString(),
    });
  }

  await insertChunks(ctx.sql, "people", people);
  await insertChunks(ctx.sql, "households", households);
  await insertChunks(ctx.sql, "household_members", members);
  await insertChunks(ctx.sql, "consents", consents);
  await insertChunks(ctx.sql, "notes", notes);

  // The minimal-profile Cooper and Adams families become full demo students.
  const cooper = sid(`household:${T}:cooper`);
  const adams = sid(`household:${T}:adams`);
  const add = (key: string, name: string, age: number, hid: string, profile: Profile, tenureDays: number) =>
    students.push({ id: sid(`person:${T}:${key}`), name, age, householdId: hid, status: "active", profile, start: new Date(now.getTime() - tenureDays * DAY), end: null, minor: true });
  add("maya-cooper", "Maya Cooper", 8, cooper, "steady", 420);
  add("leo-cooper", "Leo Cooper", 11, cooper, "steady", 900);
  add("riley-adams", "Riley Adams", 15, adams, "decaying", 700);
  for (const k of ["maya-cooper", "leo-cooper"]) {
    for (const [kind, granted] of [["media_release", true], ["ai_processing", true], ["messaging", true]] as const) {
      await ctx.sql`insert into public.consents (id, tenant_id, person_id, guardian_person_id, kind, granted, method)
        values (${sid(`consent:${k}:${kind}`)}, ${tid()}, ${sid(`person:${T}:${k}`)}, ${sid(`person:${T}:morgan-cooper`)}, ${kind}, ${granted}, 'home') on conflict do nothing`;
    }
  }
  householdIds.push(cooper, adams);
  return { students, householdIds, guardianIds, cooperHousehold: cooper };
}
