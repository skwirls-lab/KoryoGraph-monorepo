import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runJob, UnknownJobError } from "@/server/jobs/runner";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Runs a scheduled job (Vercel Cron sends GET; jobs:tick and tests POST). Bearer CRON_SECRET.
 * ?tenant=<uuid> scopes a run; ?now=<iso> injects the clock outside production (tests); other
 * query params are passed to the job.
 */
async function handle(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = await params;
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const tenant = sp.tenant ? z.uuid().safeParse(sp.tenant) : null;
  if (tenant && !tenant.success) return NextResponse.json({ error: "bad tenant" }, { status: 400 });
  let now: Date | undefined;
  if (sp.now) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "clock injection is disabled in production" }, { status: 400 });
    now = new Date(sp.now);
    if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "bad now" }, { status: 400 });
  }
  const { tenant: _t, now: _n, ...rest } = sp;
  try {
    const result = await runJob(name, { now, tenantId: tenant?.data ?? null, params: rest });
    return NextResponse.json(result, { status: result.status === "ok" ? 200 : 500 });
  } catch (err) {
    if (err instanceof UnknownJobError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export const GET = handle;
export const POST = handle;
