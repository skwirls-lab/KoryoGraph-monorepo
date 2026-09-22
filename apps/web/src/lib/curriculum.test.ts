import { describe, expect, it } from "vitest";
import { parseMoney, slugify } from "./curriculum";

describe("curriculum helpers", () => {
  it("slugifies program names", () => {
    expect(slugify("Little Tigers (4–6)")).toBe("little-tigers-4-6");
    expect(slugify("  ")).toBe("program");
  });
  it("parses money without floating point error", () => {
    expect(parseMoney("45")).toBe(4500);
    expect(parseMoney("$1,234.5")).toBe(123450);
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});
