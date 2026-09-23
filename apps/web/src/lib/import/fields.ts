/**
 * CSV import targets and vendor presets (M5.03). The Spark / Zen Planner / Kicksite column names are
 * best-known guesses at those products' member exports, not verified against their current software —
 * the mapping step always shows the result and lets the school correct it (see ADR-0040).
 */
export const IMPORT_FIELDS = [
  { key: "external_id", label: "ID in your old system", group: "Student" },
  { key: "first_name", label: "First name", group: "Student", required: true },
  { key: "last_name", label: "Last name", group: "Student" },
  { key: "dob", label: "Date of birth", group: "Student" },
  { key: "email", label: "Email", group: "Student" },
  { key: "phone", label: "Phone", group: "Student" },
  { key: "status", label: "Status (active, on hold, inactive…)", group: "Student" },
  { key: "email_opt_in", label: "Email opt-in (yes/no)", group: "Student" },
  { key: "guardian_first_name", label: "Guardian first name", group: "Household" },
  { key: "guardian_last_name", label: "Guardian last name", group: "Household" },
  { key: "guardian_email", label: "Guardian email (links siblings)", group: "Household" },
  { key: "guardian_phone", label: "Guardian phone", group: "Household" },
  { key: "program", label: "Program", group: "Rank" },
  { key: "rank", label: "Current rank", group: "Rank" },
  { key: "start_date", label: "Start date", group: "Rank" },
  { key: "classes_since_promotion", label: "Classes since last promotion", group: "Rank" },
  { key: "membership", label: "Membership plan", group: "Membership" },
  { key: "billing_day", label: "Billing day of month", group: "Membership" },
] as const;
export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Record<string, FieldKey | null>;

export const PRESETS: Record<string, { name: string; headers: Partial<Record<FieldKey, string[]>> }> = {
  spark: { name: "Spark Membership", headers: {
    external_id: ["Member ID"], first_name: ["First Name"], last_name: ["Last Name"], dob: ["Birthday"], email: ["Email"], phone: ["Mobile Phone"],
    status: ["Status"], email_opt_in: ["Email Opt-In"], guardian_first_name: ["Parent/Guardian First Name"], guardian_last_name: ["Parent/Guardian Last Name"],
    guardian_email: ["Parent/Guardian Email"], guardian_phone: ["Parent/Guardian Phone"], program: ["Program"], rank: ["Current Rank"], start_date: ["Member Since"],
    classes_since_promotion: ["Classes Since Promotion"], membership: ["Membership"], billing_day: ["Billing Day"],
  } },
  zen_planner: { name: "Zen Planner", headers: {
    external_id: ["Person ID"], first_name: ["First Name"], last_name: ["Last Name"], dob: ["Birth Date"], email: ["Email Address"], phone: ["Cell Phone"],
    status: ["Member Status"], guardian_first_name: ["Parent 1 First Name"], guardian_last_name: ["Parent 1 Last Name"], guardian_email: ["Parent 1 Email"],
    guardian_phone: ["Parent 1 Phone"], program: ["Program"], rank: ["Rank"], start_date: ["Start Date"], classes_since_promotion: ["Attendance Since Last Promotion"],
    membership: ["Membership Plan"],
  } },
  kicksite: { name: "Kicksite", headers: {
    external_id: ["Student ID"], first_name: ["First"], last_name: ["Last"], dob: ["DOB"], email: ["Email"], phone: ["Phone"], status: ["Active"],
    guardian_first_name: ["Parent First"], guardian_last_name: ["Parent Last"], guardian_email: ["Parent Email"], guardian_phone: ["Parent Phone"],
    program: ["Program"], rank: ["Belt"], start_date: ["Enrollment Date"], classes_since_promotion: ["Classes Since Last Belt"], membership: ["Membership"],
  } },
};

// Common spellings for a generic file.
const SYNONYMS: Partial<Record<FieldKey, string[]>> = {
  external_id: ["id", "memberid", "studentid", "personid", "externalid"], first_name: ["firstname", "first", "givenname"], last_name: ["lastname", "last", "surname", "familyname"],
  dob: ["dob", "birthday", "birthdate", "dateofbirth"], email: ["email", "emailaddress"], phone: ["phone", "mobile", "cell", "mobilephone", "cellphone"],
  status: ["status", "memberstatus"], guardian_email: ["parentemail", "guardianemail"], guardian_first_name: ["parentfirstname", "guardianfirstname"],
  guardian_last_name: ["parentlastname", "guardianlastname"], guardian_phone: ["parentphone", "guardianphone"], program: ["program", "style", "class"],
  rank: ["rank", "belt", "currentrank", "currentbelt"], start_date: ["startdate", "joined", "joindate", "membersince"], membership: ["membership", "plan", "membershipplan"],
};
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best preset for these headers (most exact matches), else "generic". */
export function detectPreset(headers: string[]): string {
  let best = "generic";
  let score = 2; // need at least 3 matches to call it
  for (const [key, p] of Object.entries(PRESETS)) {
    const names = new Set(Object.values(p.headers).flat().map(norm));
    const s = headers.filter((h) => names.has(norm(h))).length;
    if (s > score) { best = key; score = s; }
  }
  return best;
}

/** Header → field from the preset, then common synonyms; each field used at most once. */
export function autoMap(headers: string[], preset: string): Mapping {
  const out: Mapping = {};
  const used = new Set<FieldKey>();
  const p = PRESETS[preset];
  for (const h of headers) {
    const n = norm(h);
    const fromPreset = p ? (Object.entries(p.headers) as [FieldKey, string[]][]).find(([, names]) => names.some((x) => norm(x) === n))?.[0] : undefined;
    const fromSyn = (Object.entries(SYNONYMS) as [FieldKey, string[]][]).find(([k, names]) => !used.has(k) && names.includes(n))?.[0];
    const f = fromPreset && !used.has(fromPreset) ? fromPreset : fromSyn;
    out[h] = f ?? null;
    if (f) used.add(f);
  }
  return out;
}
