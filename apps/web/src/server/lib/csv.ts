import "server-only";
import Papa from "papaparse";

export function csvResponse(rows: Record<string, unknown>[], filename: string): Response {
  return new Response(Papa.unparse(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
  });
}
