import { sid } from "../lib/ids";
import type { SeedContext } from "./context";

export interface SeedPerson {
  key: string;
  first: string;
  last: string;
  dob?: string;
  flags: ("student" | "guardian" | "staff" | "lead")[];
  status: string;
  email?: string;
  phone?: string;
  userEmail?: string;
  allergies?: string[];
  relationship: "guardian" | "student" | "other";
  primaryGuardian?: boolean;
}

/** Insert a household with members, linking logins by email. Deterministic ids from keys. */
export async function seedHousehold(ctx: SeedContext, tenantKey: string, householdKey: string, name: string, members: SeedPerson[]): Promise<string> {
  const tenantId = sid(`tenant:${tenantKey}`);
  const householdId = sid(`household:${tenantKey}:${householdKey}`);
  const { sql } = ctx;
  for (const m of members) {
    const personId = sid(`person:${tenantKey}:${m.key}`);
    const userId = m.userEmail ? sid(`user:${m.userEmail}`) : null;
    await sql`
      insert into public.people (id, tenant_id, type_flags, first_name, last_name, dob, email, phone, status, user_id, allergies,
        primary_location_id, email_consent, phone_sms_consent)
      values (${personId}, ${tenantId}, ${m.flags}, ${m.first}, ${m.last}, ${m.dob ?? null}, ${m.email ?? null}, ${m.phone ?? null},
        ${m.status}, ${userId}, ${m.allergies ?? []}, ${sid(`location:${tenantKey}:main`)}, ${Boolean(m.email)}, ${Boolean(m.phone)})
      on conflict (id) do nothing`;
  }
  const payer = members.find((m) => m.primaryGuardian) ?? members[0];
  await sql`
    insert into public.households (id, tenant_id, name, primary_payer_person_id, billing_email)
    values (${householdId}, ${tenantId}, ${name}, ${payer ? sid(`person:${tenantKey}:${payer.key}`) : null}, ${payer?.email ?? null})
    on conflict (id) do nothing`;
  for (const m of members) {
    await sql`
      insert into public.household_members (id, tenant_id, household_id, person_id, relationship, is_primary_guardian, can_pickup, receives_billing)
      values (${sid(`household_member:${tenantKey}:${householdKey}:${m.key}`)}, ${tenantId}, ${householdId}, ${sid(`person:${tenantKey}:${m.key}`)},
        ${m.relationship}, ${Boolean(m.primaryGuardian)}, ${m.relationship === "guardian"}, ${Boolean(m.primaryGuardian)})
      on conflict (household_id, person_id) do nothing`;
  }
  return householdId;
}
