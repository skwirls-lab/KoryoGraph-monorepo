import { createHash } from "node:crypto";

/** Deterministic JSON (sorted keys) so equal inputs hash equally. */
export function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

export function inputHash(taskId: string, key: unknown): string {
  return createHash("sha256").update(`${taskId}\n${stableJson(key)}`).digest("hex").slice(0, 16);
}
