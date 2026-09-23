import { createAnonClient } from "@koryo/db/anon";
import type { Json } from "@koryo/db/types";
import { NextResponse, type NextRequest } from "next/server";
import { API_FILTERS, API_RESOURCES, type ApiResource } from "@/lib/public-api";

const problem = (status: number, message: string, headers: Record<string, string> = {}) =>
  NextResponse.json({ error: { status, message } }, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * GET /api/v1/{people|attendance|invoices|memberships} — `Authorization: Bearer kg_live_…`.
 * The key is resolved and scoped inside the database (api_list), which returns only the key's school's rows.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!(API_RESOURCES as readonly string[]).includes(resource)) return problem(404, `Unknown resource. Use one of: ${API_RESOURCES.join(", ")}.`);
  const auth = request.headers.get("authorization") ?? "";
  const key = /^Bearer (kg_live_[A-Za-z0-9_]+)$/.exec(auth)?.[1];
  if (!key) return problem(401, "Send your API key as `Authorization: Bearer kg_live_…`.", { "www-authenticate": "Bearer" });
  const sp = request.nextUrl.searchParams;
  const limit = Number(sp.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return problem(400, "limit must be 1–200.");
  const filters: Record<string, string> = {};
  for (const f of API_FILTERS[resource as ApiResource]) {
    const v = sp.get(f);
    if (v !== null) filters[f] = v;
  }
  const { data, error } = await createAnonClient().rpc("api_list", { p_key: key, p_resource: resource, p_cursor: sp.get("cursor") ?? undefined, p_limit: limit, p_filters: filters as Json });
  if (error) {
    if (error.code === "28000") return problem(401, "Invalid or revoked API key.", { "www-authenticate": "Bearer" });
    if (error.code === "42501") return problem(403, error.message);
    if (error.code === "54000") return problem(429, "Rate limit: 120 requests per minute per key.", { "retry-after": "60" });
    if (error.code === "22023" || error.code === "22P02" || error.code === "22007") return problem(400, "Invalid cursor or filter value.");
    return problem(500, "Something went wrong.");
  }
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
