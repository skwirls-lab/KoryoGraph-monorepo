import { describe, expect, it } from "vitest";
import { fillSuggestion, scheduleCandidates, type ClassStats } from "./schedule-suggestions";

const row = (o: Partial<ClassStats> & { template_id: string; name: string }): ClassStats => ({
  weekday: "Mon", start_time: "5:00 PM", program_ids: ["p1"], sessions: 4, capacity: 20, avg_attended: 10, avg_booked: 0, avg_waitlisted: 0, no_show_rate: 0, ...o,
});

describe("scheduleCandidates", () => {
  const stats = [
    row({ template_id: "full", name: "Adult Foundations", avg_attended: 19.5 }),
    row({ template_id: "wait", name: "Little Tigers", avg_attended: 12, avg_waitlisted: 3 }),
    row({ template_id: "empty", name: "Adult Morning (Tuesday)", avg_attended: 1, program_ids: ["p2"] }),
    row({ template_id: "partner", name: "Adult Morning (Thursday)", avg_attended: 5, program_ids: ["p2"] }),
    row({ template_id: "alone", name: "Open Mat", avg_attended: 2, program_ids: ["p9"] }),
    row({ template_id: "noshow", name: "Sparring", avg_attended: 8, avg_booked: 10, no_show_rate: 0.3 }),
    row({ template_id: "new", name: "New class", sessions: 1, avg_attended: 20 }),
  ];
  const c = scheduleCandidates(stats, 10);
  const by = (id: string) => c.filter((x) => x.stats.template_id === id).map((x) => `${x.kind}${x.other ? `→${x.other.template_id}` : ""}`);

  it("flags full or waitlisted classes for another section", () => {
    expect(by("full")).toEqual(["add_section"]);
    expect(by("wait")).toEqual(["add_section"]);
  });
  it("merges a near-empty class into a related one with room, else suggests moving it", () => {
    expect(by("empty")).toEqual(["merge→partner"]);
    expect(by("alone")).toEqual(["move"]);
  });
  it("flags high no-show rates on booked classes, and ignores classes without enough history", () => {
    expect(by("noshow")).toEqual(["no_show"]);
    expect(by("new")).toEqual([]);
  });
  it("fills the placeholders with the real numbers", () => {
    const m = c.find((x) => x.kind === "merge");
    if (!m) throw new Error("no merge");
    expect(fillSuggestion("{{class}} at {{utilization}} → {{other_class}}", m)).toBe("Adult Morning (Tuesday) at 5% → Adult Morning (Thursday) (Mon 5:00 PM)");
  });
});
