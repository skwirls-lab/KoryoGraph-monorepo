// Generates tests/fixtures/import/spark-sample.csv: 200 fictional students in a Spark-style member export
// (column names are our best guess at Spark's — see ADR-0040). Deterministic. `npx tsx scripts/fixtures/make-import-sample.ts`
import { writeFileSync } from "node:fs";
import Papa from "papaparse";

let seed = 20260925;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
const FIRST = ["Ava", "Liam", "Mia", "Noah", "Zoe", "Ethan", "Ivy", "Lucas", "Nora", "Owen", "Ruby", "Eli", "Aria", "Leo", "Maya", "Kai", "Lily", "Jack", "Emma", "Sam", "Isla", "Ben", "Chloe", "Finn", "Hana", "Omar", "Priya", "Diego", "Sofia", "Yuki"];
const LAST = ["Nguyen", "Garcia", "Smith", "Patel", "Kim", "Lopez", "Brown", "Wilson", "Chen", "Silva", "Khan", "Martin", "Davis", "Ito", "Rossi", "Novak", "Okafor", "Moreau", "Hughes", "Park", "Reyes", "Singh", "Ward", "Cohen", "Bauer"];
const PARENT = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Jamie", "Avery", "Quinn", "Drew"];
const RANKS = ["White belt", "Yellow belt", "Orange belt", "Green belt", "Purple belt", "Blue belt", "Brown belt"];
const STATUS = ["Active", "Active", "Active", "Active", "Active", "Active", "Frozen", "Inactive"];

const rows: Record<string, string>[] = [];
let id = 1000;
while (rows.length < 200) {
  const last = pick(LAST);
  const kids = rows.length > 185 ? 1 : pick([1, 1, 1, 2, 2, 3]);
  const adult = rnd() < 0.12;
  const parentFirst = pick(PARENT);
  const parentEmail = `${parentFirst.toLowerCase()}.${last.toLowerCase()}${id}@example.test`;
  for (let k = 0; k < (adult ? 1 : kids) && rows.length < 200; k++) {
    const first = pick(FIRST);
    const year = adult ? 1975 + Math.floor(rnd() * 25) : 2010 + Math.floor(rnd() * 12);
    const dob = `${1 + Math.floor(rnd() * 12)}/${1 + Math.floor(rnd() * 28)}/${year}`;
    const since = `${1 + Math.floor(rnd() * 12)}/${1 + Math.floor(rnd() * 28)}/${2021 + Math.floor(rnd() * 5)}`;
    rows.push({
      "Member ID": `SP-${++id}`, "First Name": first, "Last Name": last, Birthday: dob,
      Email: adult ? `${first.toLowerCase()}.${last.toLowerCase()}${id}@example.test` : "", "Mobile Phone": adult ? `(303) 555-${String(1000 + id).slice(-4)}` : "",
      Status: pick(STATUS), "Email Opt-In": rnd() < 0.85 ? "Yes" : "No",
      "Parent/Guardian First Name": adult ? "" : parentFirst, "Parent/Guardian Last Name": adult ? "" : last, "Parent/Guardian Email": adult ? "" : parentEmail,
      "Parent/Guardian Phone": adult ? "" : `(303) 555-${String(2000 + id).slice(-4)}`,
      Program: "Taekwondo", "Current Rank": pick(RANKS), "Member Since": since, "Classes Since Promotion": String(Math.floor(rnd() * 30)),
      Membership: "Unlimited Monthly", "Billing Day": String(1 + Math.floor(rnd() * 28)),
    });
  }
}
writeFileSync("tests/fixtures/import/spark-sample.csv", `${Papa.unparse(rows)}\n`);
console.log(`wrote ${rows.length} rows, ${new Set(rows.map((r) => r["Parent/Guardian Email"]).filter(Boolean)).size} guardian emails`);
