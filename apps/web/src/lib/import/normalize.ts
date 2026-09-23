import type { FieldKey, Mapping } from "./fields";

export interface Lookups {
  programs: { id: string; name: string; ranks: { id: string; name: string }[] }[];
  plans: { id: string; name: string }[];
  today: string;
}

export interface ImportRow {
  row: number; external_id: string | null; first_name: string; last_name: string; dob: string | null; email: string | null; phone: string | null;
  status: string | null; email_consent: boolean | null; guardian: { first_name: string; last_name: string; email: string; phone: string | null } | null;
  program_id: string | null; rank_id: string | null; start_date: string | null; classes_since_promotion: number | null; plan_id: string | null; billing_day: number | null;
}
export interface RowIssue { row: number; field: string; message: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** ISO, US (M/D/YYYY, M/D/YY) dates → YYYY-MM-DD; null if empty; undefined if unreadable. */
export function parseDate(v: string, today: string): string | null | undefined {
  const s = v.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) {
    [m, d, y] = [Number(us[1]), Number(us[2]), Number(us[3])];
    if (us[3]?.length === 2) y += y <= Number(today.slice(2, 4)) ? 2000 : 1900;
  } else return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseStatus(v: string): string | null | undefined {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (["active", "current", "yes", "true", "1", "member"].includes(s)) return "active";
  if (["hold", "on hold", "on_hold", "frozen", "paused", "freeze"].includes(s)) return "on_hold";
  if (["trial", "prospect"].includes(s)) return "trial";
  if (["inactive", "former", "cancelled", "canceled", "no", "false", "0", "alumni", "expired"].includes(s)) return "alumni";
  return undefined;
}

const yesNo = (v: string): boolean | null => {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  return ["yes", "y", "true", "1", "opted in", "subscribed"].includes(s) ? true : ["no", "n", "false", "0", "opted out", "unsubscribed"].includes(s) ? false : null;
};

/** Rank names in exports are often shorter ("Yellow belt") than the school's ("Yellow belt (9th gup)"). */
function findRank(ranks: { id: string; name: string }[], value: string) {
  const v = value.trim().toLowerCase();
  return ranks.find((r) => r.name.toLowerCase() === v) ?? ranks.find((r) => { const n = r.name.toLowerCase(); return n.startsWith(`${v} `) || n.startsWith(`${v}(`); });
}

/** Map + validate every row. Rows with errors are left out of `rows`; warnings keep the row. */
export function normalizeRows(records: Record<string, string>[], mapping: Mapping, lk: Lookups): { rows: ImportRow[]; errors: RowIssue[]; warnings: RowIssue[] } {
  const col = (f: FieldKey) => Object.entries(mapping).find(([, v]) => v === f)?.[0];
  const cols = Object.fromEntries((["external_id", "first_name", "last_name", "dob", "email", "phone", "status", "email_opt_in", "guardian_first_name", "guardian_last_name", "guardian_email", "guardian_phone", "program", "rank", "start_date", "classes_since_promotion", "membership", "billing_day"] as FieldKey[]).map((f) => [f, col(f)])) as Record<FieldKey, string | undefined>;
  const get = (rec: Record<string, string>, f: FieldKey) => (cols[f] ? (rec[cols[f] as string] ?? "").trim() : "");
  const rows: ImportRow[] = [];
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const seenIds = new Set<string>();
  records.forEach((rec, i) => {
    const row = i + 2; // header is line 1
    const err = (field: string, message: string) => errors.push({ row, field, message });
    const rowWarnings: RowIssue[] = [];
    const warn = (field: string, message: string) => rowWarnings.push({ row, field, message });
    const before = errors.length;
    const first = get(rec, "first_name");
    if (!first) err("first_name", "First name is missing");
    const ext = get(rec, "external_id") || null;
    if (ext && seenIds.has(ext)) err("external_id", `ID ${ext} appears twice in the file`);
    if (ext) seenIds.add(ext);
    const dob = parseDate(get(rec, "dob"), lk.today);
    if (dob === undefined) err("dob", `Can't read the date "${get(rec, "dob")}"`);
    else if (dob && dob > lk.today) err("dob", "Date of birth is in the future");
    const email = get(rec, "email").toLowerCase() || null;
    if (email && !EMAIL.test(email)) err("email", `"${email}" isn't an email address`);
    const status = parseStatus(get(rec, "status"));
    if (status === undefined) warn("status", `Unknown status "${get(rec, "status")}" — imported as active`);
    const gEmail = get(rec, "guardian_email").toLowerCase();
    if (gEmail && !EMAIL.test(gEmail)) err("guardian_email", `"${gEmail}" isn't an email address`);
    const minor = dob ? Number(lk.today.slice(0, 4)) - Number(dob.slice(0, 4)) < 18 : false;
    if (minor && !gEmail) warn("guardian_email", "Under 18 with no guardian email — they'll get a household of their own");
    let program_id: string | null = null;
    let rank_id: string | null = null;
    const progName = get(rec, "program");
    if (progName) {
      const p = lk.programs.find((x) => x.name.toLowerCase() === progName.toLowerCase());
      if (!p) err("program", `No program called "${progName}" — create it first or fix the name`);
      else {
        program_id = p.id;
        const rankName = get(rec, "rank");
        if (rankName) {
          const r = findRank(p.ranks, rankName);
          if (!r) err("rank", `No rank "${rankName}" in ${p.name}`);
          else rank_id = r.id;
        }
      }
    } else if (get(rec, "rank")) err("program", "A rank needs a program");
    const start = parseDate(get(rec, "start_date"), lk.today);
    if (start === undefined) err("start_date", `Can't read the date "${get(rec, "start_date")}"`);
    const csp = get(rec, "classes_since_promotion");
    const classes = csp ? Number(csp) : null;
    if (classes !== null && (!Number.isInteger(classes) || classes < 0 || classes > 10000)) err("classes_since_promotion", `"${csp}" isn't a number of classes`);
    let plan_id: string | null = null;
    const planName = get(rec, "membership");
    if (planName) {
      plan_id = lk.plans.find((x) => x.name.toLowerCase() === planName.toLowerCase())?.id ?? null;
      if (!plan_id) warn("membership", `No membership plan called "${planName}" — the student is imported without a membership`);
    }
    const bd = get(rec, "billing_day");
    const billing_day = bd ? Number(bd) : null;
    if (billing_day !== null && (!Number.isInteger(billing_day) || billing_day < 1 || billing_day > 31)) err("billing_day", `"${bd}" isn't a day of the month`);
    // A rejected row only reports its errors; warnings describe rows that will be imported.
    if (errors.length > before) return;
    warnings.push(...rowWarnings);
    rows.push({
      row, external_id: ext, first_name: first, last_name: get(rec, "last_name"), dob: dob ?? null, email, phone: get(rec, "phone") || null,
      status: status ?? "active", email_consent: yesNo(get(rec, "email_opt_in")),
      guardian: gEmail ? { first_name: get(rec, "guardian_first_name"), last_name: get(rec, "guardian_last_name"), email: gEmail, phone: get(rec, "guardian_phone") || null } : null,
      program_id, rank_id, start_date: start ?? null, classes_since_promotion: classes, plan_id, billing_day: billing_day === null ? null : Math.min(28, billing_day),
    });
  });
  return { rows, errors, warnings };
}
