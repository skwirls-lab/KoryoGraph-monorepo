import "server-only";

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every row of a query in 1,000-row pages (PostgREST's cap). */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
