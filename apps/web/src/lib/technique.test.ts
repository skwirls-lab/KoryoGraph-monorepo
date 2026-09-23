import { describe, expect, it } from "vitest";
import { weightedOverall } from "./technique";

describe("weightedOverall", () => {
  it("weights by the rubric (fractions or percentages), ignoring unknown criteria", () => {
    const rubric = [{ criterion: "Technique", weight: 0.5 }, { criterion: "Power & focus", weight: 0.3 }, { criterion: "Balance & control", weight: 0.2 }];
    expect(weightedOverall([{ criterion: "Technique", score: 4 }, { criterion: "power & focus", score: 3 }, { criterion: "Balance & control", score: 5 }, { criterion: "Extra", score: 1 }], rubric)).toBe(3.9);
    expect(weightedOverall([{ criterion: "A", score: 2 }, { criterion: "B", score: 4 }], [{ criterion: "A", weight: 25 }, { criterion: "B", weight: 75 }])).toBe(3.5);
  });
  it("falls back to the plain mean when nothing matches the rubric", () => {
    expect(weightedOverall([{ criterion: "X", score: 2 }, { criterion: "Y", score: 5 }], [])).toBe(3.5);
  });
});
