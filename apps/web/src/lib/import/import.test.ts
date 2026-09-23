import { describe, expect, it } from "vitest";
import { autoMap, detectPreset } from "./fields";
import { normalizeRows, parseDate, parseStatus, type Lookups } from "./normalize";

const LK: Lookups = {
  today: "2026-09-25",
  programs: [{ id: "p1", name: "Taekwondo", ranks: [{ id: "r1", name: "White belt (10th gup)" }, { id: "r2", name: "Yellow belt (9th gup)" }] }],
  plans: [{ id: "m1", name: "Unlimited Monthly" }],
};

describe("import mapping", () => {
  it("detects the vendor preset and maps its columns; generic files map by common spellings", () => {
    const spark = ["Member ID", "First Name", "Last Name", "Birthday", "Parent/Guardian Email", "Current Rank", "Program"];
    expect(detectPreset(spark)).toBe("spark");
    expect(autoMap(spark, "spark")).toMatchObject({ "Member ID": "external_id", Birthday: "dob", "Parent/Guardian Email": "guardian_email", "Current Rank": "rank" });
    expect(detectPreset(["Kid", "Surname", "Notes"])).toBe("generic");
    expect(autoMap(["First name", "SURNAME", "Date of Birth", "Belt", "Favourite colour"], "generic")).toEqual({
      "First name": "first_name", SURNAME: "last_name", "Date of Birth": "dob", Belt: "rank", "Favourite colour": null,
    });
  });
});

describe("import rows", () => {
  it("reads US and ISO dates and statuses", () => {
    expect(parseDate("3/2/2016", "2026-09-25")).toBe("2016-03-02");
    expect(parseDate("03/02/16", "2026-09-25")).toBe("2016-03-02");
    expect(parseDate("12/31/85", "2026-09-25")).toBe("1985-12-31");
    expect(parseDate("2016-02-30", "2026-09-25")).toBeUndefined();
    expect(parseStatus("Frozen")).toBe("on_hold");
    expect(parseStatus("Cancelled")).toBe("alumni");
  });

  it("resolves programs, short rank names and plans; reports errors and warnings by line", () => {
    const mapping = { ID: "external_id", First: "first_name", Last: "last_name", DOB: "dob", Parent: "guardian_email", Program: "program", Rank: "rank", Plan: "membership" } as const;
    const r = normalizeRows([
      { ID: "A1", First: "Kenji", Last: "Nakamura", DOB: "2016-03-02", Parent: "aiko@example.test", Program: "Taekwondo", Rank: "Yellow belt", Plan: "Unlimited Monthly" },
      { ID: "A2", First: "", Last: "X", DOB: "", Parent: "", Program: "", Rank: "", Plan: "" },
      { ID: "A3", First: "Mia", Last: "Ross", DOB: "2030-01-01", Parent: "", Program: "Karate", Rank: "", Plan: "" },
      { ID: "A1", First: "Dup", Last: "Row", DOB: "", Parent: "", Program: "", Rank: "", Plan: "Gold" },
      { ID: "A5", First: "Ava", Last: "Lin", DOB: "2015-05-05", Parent: "", Program: "", Rank: "", Plan: "Gold" },
    ], mapping, LK);
    expect(r.rows.map((x) => x.row)).toEqual([2, 6]);
    expect(r.rows[0]).toMatchObject({ program_id: "p1", rank_id: "r2", plan_id: "m1", guardian: { email: "aiko@example.test" } });
    expect(r.errors.map((e) => `${e.row}:${e.field}`)).toEqual(["3:first_name", "4:dob", "4:program", "5:external_id"]);
    expect(r.warnings.map((e) => `${e.row}:${e.field}`)).toEqual(["6:guardian_email", "6:membership"]);
  });
});
