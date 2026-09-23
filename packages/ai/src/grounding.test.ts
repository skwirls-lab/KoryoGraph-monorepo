import { describe, expect, it } from "vitest";
import { renderGrounded } from "./grounding";
import { copilotStepOutput } from "./tasks/copilot";

describe("renderGrounded", () => {
  it("fills placeholders from observations and flags unknown paths", () => {
    const obs = [{ result: { count: 1234, total: "$5,200.00", rows: [{ name: "A" }] } }, { result: 7 }];
    expect(renderGrounded("{{obs.0.count}} students owe {{obs.0.total}}; {{obs.1}} more; {{obs.0.rows.0.name}}", obs).text).toBe("1,234 students owe $5,200.00; 7 more; A");
    const r = renderGrounded("{{obs.0.nope}} and {{obs.3.count}} and {{obs.0.rows}}", obs);
    expect(r.text).toBe("[unknown] and [unknown] and [unknown]");
    expect(r.missing).toHaveLength(3);
  });
});

describe("copilot step schema", () => {
  it("accepts a typed tool call or an answer, rejects wrong args", () => {
    expect(copilotStepOutput.safeParse({ type: "tool", tool: "run_report", args: { key: "past_due" } }).success).toBe(true);
    expect(copilotStepOutput.safeParse({ type: "tool", tool: "run_report", args: { key: "salaries" } }).success).toBe(false);
    expect(copilotStepOutput.safeParse({ type: "tool", tool: "delete_everything", args: {} }).success).toBe(false);
    expect(copilotStepOutput.safeParse({ type: "answer", text: "Hi", citations: [{ kind: "report", id: "past_due", label: "AR" }] }).success).toBe(true);
  });
});
