import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("keeps a short document whole, titled", () => {
    expect(chunkText("Refund policy", "Refunds within 30 days.\n\nNo refunds on testing fees.")).toEqual(["Refund policy\n\nRefunds within 30 days.\n\nNo refunds on testing fees."]);
  });
  it("splits long documents under the limit with overlap on sentence boundaries", () => {
    const para = (n: number) => Array.from({ length: 12 }, (_, i) => `Paragraph ${n} sentence ${i} has some words in it.`).join(" ");
    const body = Array.from({ length: 10 }, (_, i) => para(i)).join("\n\n");
    const chunks = chunkText("Handbook", body, { maxChars: 1200, overlap: 200 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1200 + "Handbook\n\n".length + 200);
    // Every sentence survives somewhere.
    for (let p = 0; p < 10; p++) for (let s = 0; s < 12; s++) expect(chunks.some((c) => c.includes(`Paragraph ${p} sentence ${s} `))).toBe(true);
    // Overlap: the next chunk starts with text from the end of the previous one.
    const second = chunks[1]?.replace("Handbook\n\n", "") ?? "";
    expect(chunks[0]?.includes(second.slice(0, 40))).toBe(true);
  });
  it("hard-splits a single enormous sentence and ignores empty input", () => {
    expect(chunkText("X", "a".repeat(5000), { maxChars: 2000 }).length).toBe(3);
    expect(chunkText("X", "  \n\n ")).toEqual([]);
  });
});
