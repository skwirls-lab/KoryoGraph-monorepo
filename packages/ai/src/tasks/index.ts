import type { AiTask } from "../types";
import { actionBoard, transcribe } from "./action-board";
import { copilotStep, homeAssistant } from "./copilot";
import { driftOutreach } from "./drift";
import { billingRecovery, leadNextAction, parentNarrative } from "./growth";
import { packingSlip } from "./intake";
import { lessonBuilder } from "./lessons";
import { nlReport } from "./nl-report";
import { ping } from "./ping";

/** Every task the product runs (ai:eval and ai:record iterate this). */
export const TASKS: Record<string, AiTask<never, unknown>> = {
  ping: ping as unknown as AiTask<never, unknown>,
  copilot_step: copilotStep as unknown as AiTask<never, unknown>,
  home_assistant: homeAssistant as unknown as AiTask<never, unknown>,
  drift_outreach: driftOutreach as unknown as AiTask<never, unknown>,
  transcribe: transcribe as unknown as AiTask<never, unknown>,
  action_board: actionBoard as unknown as AiTask<never, unknown>,
  lesson_builder: lessonBuilder as unknown as AiTask<never, unknown>,
  packing_slip: packingSlip as unknown as AiTask<never, unknown>,
  nl_report: nlReport as unknown as AiTask<never, unknown>,
  billing_recovery: billingRecovery as unknown as AiTask<never, unknown>,
  parent_narrative: parentNarrative as unknown as AiTask<never, unknown>,
  lead_next_action: leadNextAction as unknown as AiTask<never, unknown>,
};
export { ping };
export * from "./copilot";
export * from "./drift";
export * from "./action-board";
export * from "./lessons";
export * from "./intake";
export * from "./nl-report";
export * from "./growth";
