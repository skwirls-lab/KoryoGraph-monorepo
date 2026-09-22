import { createHash } from "node:crypto";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import { seedMember } from "../tenant";
import type { DemoPeople } from "./people";
import { DAY, insertChunks, isoDate, type Rng } from "./rng";

const T = "ridgeline";
const tid = () => sid(`tenant:${T}`);

export const EXTRA_STAFF = [
  { role: "front_desk", email: "frontdesk2@ridgelinetkd.demo", name: "Nia Robinson" },
  { role: "instructor", email: "instructor2@ridgelinetkd.demo", name: "Kyoshi Daniel Cho" },
  { role: "instructor", email: "instructor3@ridgelinetkd.demo", name: "Ms. Hannah Brooks" },
  { role: "instructor", email: "instructor4@ridgelinetkd.demo", name: "Master Omar Haddad" },
] as const;

export async function seedStaff(ctx: SeedContext): Promise<void> {
  for (const s of EXTRA_STAFF) await seedMember(ctx, T, s.role, s.email, s.name);
}

const WAIVER_V1 = `# Liability waiver

I, {{guardian_name}}, am the parent or legal guardian of {{student_name}} (or the student, if an adult) and give permission to take part in martial arts classes, testing and events at {{school_name}}.

I understand that martial arts training involves physical activity and contact, and a risk of injury including:
- bruises, sprains and strains
- injuries from falls or contact with other students

I confirm the student is in good health and I will tell the school about any medical condition or injury.`;

const WAIVER_V2 = `${WAIVER_V1}

# Photos and video

Class photos may be taken for progress tracking. Photos are only shared publicly with separate media-release consent.

# Communication

I agree to receive class updates by email or text as chosen in my account, and I can change this at any time.`;

export async function seedExtras(ctx: SeedContext, rng: Rng, now: Date, people: DemoPeople): Promise<void> {
  const sql = ctx.sql;
  const user = (email: string) => sid(`user:${email}`);

  await insertChunks(sql, "staff_certifications", [
    { id: sid(`cert:${T}:cpr-i2`), tenant_id: tid(), user_id: user("instructor2@ridgelinetkd.demo"), kind: "CPR / First aid", issuer: "Red Cross", issued_at: isoDate(new Date(now.getTime() - 710 * DAY)), expires_at: isoDate(new Date(now.getTime() + 20 * DAY)) },
    { id: sid(`cert:${T}:cpr-i1`), tenant_id: tid(), user_id: user("instructor@ridgelinetkd.demo"), kind: "CPR / First aid", issuer: "Red Cross", issued_at: isoDate(new Date(now.getTime() - 200 * DAY)), expires_at: isoDate(new Date(now.getTime() + 530 * DAY)) },
    { id: sid(`cert:${T}:bg-i3`), tenant_id: tid(), user_id: user("instructor3@ridgelinetkd.demo"), kind: "Background check", issuer: "Sterling", issued_at: isoDate(new Date(now.getTime() - 300 * DAY)), expires_at: isoDate(new Date(now.getTime() + 430 * DAY)) },
    { id: sid(`cert:${T}:dan-owner`), tenant_id: tid(), user_id: user("owner@ridgelinetkd.demo"), kind: "Kukkiwon 6th dan", issuer: "Kukkiwon", issued_at: "2019-05-01", expires_at: null },
  ]);

  // Kiosk device record (a live tablet is paired during the demo; this one shows the list).
  await insertChunks(sql, "kiosk_devices", [{
    id: sid(`kiosk:${T}:front`), tenant_id: tid(), location_id: sid(`location:${T}:main`), name: "Front desk iPad (retired)",
    token_hash: createHash("sha256").update(`retired-${T}`).digest("hex"), revoked_at: new Date(now.getTime() - 30 * DAY).toISOString(),
    last_seen_at: new Date(now.getTime() - 31 * DAY).toISOString(),
  }]);

  // Family PINs: Cooper = 4321 (documented), others deterministic.
  for (const hid of people.householdIds) {
    const pin = hid === people.cooperHousehold ? "4321" : String(rng.int(1000, 9999));
    await sql`insert into public.kiosk_pins (id, tenant_id, household_id, pin_hash) values (${sid(`pin:${hid}`)}, ${tid()}, ${hid}, extensions.crypt(${pin}, extensions.gen_salt('bf', 6))) on conflict do nothing`;
  }

  // Waiver v1 (18 months ago, signed by ~92% of families) and v2 (last week, ~55% re-signed).
  const v1 = sid(`doc:${T}:waiver:1`);
  const v2 = sid(`doc:${T}:waiver:2`);
  await insertChunks(sql, "document_templates", [
    { id: v1, tenant_id: tid(), kind: "waiver", name: "Liability waiver", version: 1, body: WAIVER_V1, required_for: sql.json({ all_students: true, program_ids: [] }), active: false, published_at: new Date(now.getTime() - 540 * DAY).toISOString(), published_by: user("owner@ridgelinetkd.demo") },
    { id: v2, tenant_id: tid(), kind: "waiver", name: "Liability waiver", version: 2, body: WAIVER_V2, required_for: sql.json({ all_students: true, program_ids: [] }), active: true, published_at: new Date(now.getTime() - 6 * DAY).toISOString(), published_by: user("owner@ridgelinetkd.demo") },
  ]);
  const guardianOf = new Map<string, string>();
  const rows = await sql<{ household_id: string; person_id: string; first_name: string; last_name: string }[]>`
    select hm.household_id, hm.person_id, p.first_name, p.last_name from public.household_members hm join public.people p on p.id = hm.person_id
    where hm.tenant_id = ${tid()} and hm.relationship = 'guardian' and hm.is_primary_guardian`;
  for (const r of rows) guardianOf.set(r.household_id, r.person_id);
  const names = new Map(rows.map((r) => [r.person_id, `${r.first_name} ${r.last_name}`]));
  const sigs: Record<string, unknown>[] = [];
  const householdSigned = new Map<string, boolean>();
  for (const s of people.students.filter((x) => x.status !== "alumni")) {
    const signs1 = householdSigned.get(s.householdId) ?? rng.chance(0.92);
    householdSigned.set(s.householdId, signs1);
    const signer = guardianOf.get(s.householdId) ?? null;
    const typed = (signer && names.get(signer)) || s.name;
    if (signs1) sigs.push({ id: sid(`sig:${v1}:${s.id}`), tenant_id: tid(), template_id: v1, person_id: s.id, signer_person_id: signer, typed_name: typed, method: rng.pick(["home", "desk", "kiosk"]), signed_at: new Date(Math.max(s.start.getTime(), now.getTime() - 530 * DAY)).toISOString(), ip: "198.51.100.10" });
    const isCooper = s.householdId === people.cooperHousehold;
    if (!isCooper && rng.chance(0.55)) sigs.push({ id: sid(`sig:${v2}:${s.id}`), tenant_id: tid(), template_id: v2, person_id: s.id, signer_person_id: signer, typed_name: typed, method: "home", signed_at: new Date(now.getTime() - rng.int(0, 5) * DAY).toISOString(), ip: "198.51.100.20" });
  }
  await insertChunks(sql, "signatures", sigs);

  // Conversations (15 threads) and Outbox samples in each status.
  const families = people.householdIds.filter((h) => guardianOf.has(h)).slice(0, 15);
  const threads: Record<string, unknown>[] = [];
  const msgs: Record<string, unknown>[] = [];
  const topics = ["Belt test on Saturday", "Missing class next week", "Uniform size question", "Birthday party booking", "Sparring gear", "Schedule change", "Payment question", "Summer camp dates"];
  families.forEach((hid, i) => {
    const id = sid(`thread:${T}:${i}`);
    const at = new Date(now.getTime() - rng.int(0, 20) * DAY - rng.int(1, 600) * 60_000);
    const unread = i % 3 === 0 ? 1 : 0;
    threads.push({ id, tenant_id: tid(), household_id: hid, subject: topics[i % topics.length], last_message_at: at.toISOString(), unread_staff: unread, unread_household: i % 4 === 1 ? 1 : 0, status: i > 11 ? "closed" : "open" });
    msgs.push({ id: sid(`tmsg:${id}:1`), tenant_id: tid(), thread_id: id, sender_person_id: guardianOf.get(hid), from_staff: false, body: "Hi! Quick question about this — could someone get back to me?", created_at: new Date(at.getTime() - 3600_000).toISOString() });
    if (!unread) msgs.push({ id: sid(`tmsg:${id}:2`), tenant_id: tid(), thread_id: id, sender_user_id: user("frontdesk@ridgelinetkd.demo"), from_staff: true, body: "Thanks for asking — we'll sort that out at the desk tonight.", created_at: at.toISOString() });
  });
  await insertChunks(sql, "message_threads", threads);
  await insertChunks(sql, "thread_messages", msgs);

  const statuses = ["unsent_no_provider", "unsent_no_provider", "unsent_no_provider", "deferred", "opted_out", "no_address", "failed"] as const;
  await insertChunks(sql, "communications", statuses.map((status, i) => {
    const g = rows[i % rows.length];
    return {
      id: sid(`comm:${T}:sample:${i}`), tenant_id: tid(), channel: status === "deferred" ? "sms" : "email", person_id: g?.person_id ?? null, household_id: g?.household_id ?? null,
      to_address: status === "no_address" ? null : status === "deferred" ? "(555) 010-0000" : `${g?.first_name.toLowerCase()}@example.test`, template_key: "class_cancelled",
      subject: "Youth Taekwondo is cancelled", body_text: "Youth Taekwondo is cancelled (instructor at tournament).", status,
      error: status === "failed" ? "Mailbox unavailable (test sample)" : null,
      scheduled_for: status === "deferred" ? new Date(now.getTime() + 10 * 3600_000).toISOString() : null,
      created_at: new Date(now.getTime() - (i + 1) * 3 * DAY).toISOString(),
    };
  }));

  // A few makeup credits.
  await insertChunks(sql, "makeup_credits", rng.sample(people.students.filter((s) => s.status === "active"), 6).map((s) => ({
    id: sid(`credit:${s.id}`), tenant_id: tid(), person_id: s.id, reason: "cancelled in time", expires_at: new Date(now.getTime() + rng.int(10, 50) * DAY).toISOString(),
  })));
}
