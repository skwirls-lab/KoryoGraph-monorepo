import { describe, expect, it } from "vitest";
import { sid } from "./ids";

describe("sid", () => {
  it("is deterministic, unique per key and a valid v5-layout UUID", () => {
    expect(sid("tenant:ridgeline")).toBe(sid("tenant:ridgeline"));
    expect(sid("tenant:ridgeline")).not.toBe(sid("tenant:harbor"));
    expect(sid("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
