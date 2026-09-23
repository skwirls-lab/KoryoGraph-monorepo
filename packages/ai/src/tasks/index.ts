import type { AiTask } from "../types";
import { ping } from "./ping";

/** Every task the product runs (ai:eval and ai:record iterate this). */
export const TASKS: Record<string, AiTask<never, unknown>> = {
  ping: ping as unknown as AiTask<never, unknown>,
};
export { ping };
