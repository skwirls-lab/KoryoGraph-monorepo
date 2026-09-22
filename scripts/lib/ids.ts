import { createHash } from "node:crypto";

/**
 * Deterministic UUID for a seed key (RFC 4122 v5-style layout over SHA-1 of "koryograph:<key>").
 * Stable across runs and independent of insertion order, so `db:reset` twice yields identical ids.
 */
export function sid(key: string): string {
  const h = createHash("sha1").update(`koryograph:${key}`).digest();
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50;
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
