import { z } from "zod";
import { runCopilot, type CopilotEvent } from "@/server/copilot/run";
import { getOptionalCtx } from "@/server/context";

export const dynamic = "force-dynamic";

const body = z.object({ conversationId: z.uuid().nullish(), question: z.string().trim().min(1).max(2000) });

/** Streams one copilot turn as NDJSON events (tool steps as they run, then the answer). */
export async function POST(request: Request) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("desk.access") || !ctx.permissions.has("ai.use")) return new Response("Forbidden", { status: 403 });
  if (!ctx.modules.has("intelligence")) return new Response("The copilot is part of the Intelligence module.", { status: 402 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Ask a question", { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: CopilotEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        await runCopilot(ctx, parsed.data, emit);
      } catch {
        emit({ type: "error", message: "Something went wrong answering that." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
