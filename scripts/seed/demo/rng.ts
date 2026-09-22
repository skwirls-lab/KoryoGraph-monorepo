import type { ParameterOrJSON, Sql } from "postgres";
import seedrandom from "seedrandom";

/** Deterministic randomness for the demo seed (seedrandom('koryograph')). */
export class Rng {
  private r: seedrandom.PRNG;
  constructor(seed = "koryograph") {
    this.r = seedrandom(seed);
  }
  next(): number {
    return this.r();
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    const v = items[Math.floor(this.next() * items.length)];
    if (v === undefined) throw new Error("pick from empty list");
    return v;
  }
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let x = this.next() * total;
    for (const [v, w] of entries) {
      if ((x -= w) < 0) return v;
    }
    return (entries[entries.length - 1] as readonly [T, number])[0];
  }
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j] as T, items[i] as T];
    }
    return items;
  }
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle([...items]).slice(0, Math.max(0, Math.min(n, items.length)));
  }
}

export const DAY = 86_400_000;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Insert rows in chunks with postgres.js (fast multi-row insert). Rows are grouped by their key set so
 * omitted columns keep their database defaults (postgres.js takes columns from the first row).
 */
export async function insertChunks(
  sql: Sql,
  table: string,
  rows: Record<string, unknown>[],
  chunk = 1000,
): Promise<void> {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const clean = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
    const key = Object.keys(clean).sort().join(",");
    (groups.get(key) ?? groups.set(key, []).get(key))?.push(clean);
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += chunk) {
      const part = group.slice(i, i + chunk) as Record<string, ParameterOrJSON<never>>[];
      await sql`insert into ${sql(table)} ${sql(part)} on conflict (id) do nothing`;
    }
  }
}
