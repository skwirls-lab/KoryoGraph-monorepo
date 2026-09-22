import "server-only";
import pino, { type Logger } from "pino";

const root = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "koryograph-web" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface LogContext {
  tenantId?: string | null;
  userId?: string | null;
  requestId?: string | null;
}

/** Structured logger; every server line carries tenant_id and user_id (§0.6). */
export function logger(ctx: LogContext = {}): Logger {
  return root.child({ tenant_id: ctx.tenantId ?? null, user_id: ctx.userId ?? null, request_id: ctx.requestId ?? null });
}
