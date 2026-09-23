import type { AiTask } from "../types";
import { copilotStep, homeAssistant } from "./copilot";
import { ping } from "./ping";

/** Every task the product runs (ai:eval and ai:record iterate this). */
export const TASKS: Record<string, AiTask<never, unknown>> = {
  ping: ping as unknown as AiTask<never, unknown>,
  copilot_step: copilotStep as unknown as AiTask<never, unknown>,
  home_assistant: homeAssistant as unknown as AiTask<never, unknown>,
};
export { ping };
export * from "./copilot";
