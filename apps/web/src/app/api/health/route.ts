import { aiTransportMode } from "@koryo/ai";

export const dynamic = "force-dynamic";

/** Liveness plus the AI transport in effect (the M4+ gate refuses to run e2e against a live-AI server). */
export function GET() {
  return Response.json({ status: "ok", ai: { transport: aiTransportMode(process.env) } }, { headers: { "cache-control": "no-store" } });
}
