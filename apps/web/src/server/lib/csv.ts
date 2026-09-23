import "server-only";
import Papa from "papaparse";

/** CSV download. Pass `fields` to fix the columns (and still get a header row when there are no rows). */
export function csvResponse(rows: Record<string, unknown>[], filename: string, fields?: string[]): Response {
  const body = fields ? Papa.unparse({ fields, data: rows.map((r) => fields.map((f) => r[f] ?? "")) }) : Papa.unparse(rows);
  return new Response(body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
  });
}
