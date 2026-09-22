import { describe, expect, it } from "vitest";
import { mergeDoc, parseDocBody } from "./documents";

describe("document bodies", () => {
  it("parses headings, paragraphs and bullets", () => {
    expect(parseDocBody("# Waiver\n\nI understand\nthe risks.\n\n- Bruises\n- Sprains\nFinal line")).toEqual([
      { type: "h", text: "Waiver" },
      { type: "p", text: "I understand the risks." },
      { type: "ul", items: ["Bruises", "Sprains"] },
      { type: "p", text: "Final line" },
    ]);
  });
  it("treats HTML as text", () => {
    expect(parseDocBody("<script>alert(1)</script>")).toEqual([{ type: "p", text: "<script>alert(1)</script>" }]);
  });
  it("merges fields", () => {
    expect(mergeDoc("I, {{guardian_name}}, for {{student_name}} at {{school_name}}", { guardian_name: "Morgan Cooper", student_name: "Maya", school_name: "Ridgeline" }))
      .toBe("I, Morgan Cooper, for Maya at Ridgeline");
  });
});
