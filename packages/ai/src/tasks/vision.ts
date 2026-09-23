import { z } from "zod";
import type { AiTask } from "../types";

// ---------------------------------------------------------------- A11 Technique feedback
export const techniqueFeedbackInput = z.object({
  skill: z.string().min(1),
  category: z.string(),
  description: z.string().max(2000),
  rubric: z.array(z.object({ criterion: z.string().min(1).max(80), weight: z.number().min(0).max(100) })).min(1).max(8),
  /** JPEG keyframes of the student's clip, in order (base64). */
  frames: z.array(z.string().min(100)).min(1).max(8),
  /** Optional instructor "gold standard" keyframes for the same skill. */
  goldFrames: z.array(z.string().min(100)).max(6),
  /** sha256 of the uploaded clip (fixture key: frame extraction is deterministic per file). */
  sha256: z.string().length(64),
});
export type TechniqueFeedbackInput = z.infer<typeof techniqueFeedbackInput>;
export const techniqueFeedbackOutput = z.object({
  scores: z.array(z.object({ criterion: z.string().min(1).max(80), score: z.number().int().min(1).max(5), note: z.string().min(3).max(240) })).min(1).max(8),
  summary: z.string().min(10).max(500),
  tips: z.array(z.string().min(5).max(200)).length(3),
});
export type TechniqueFeedbackOutput = z.infer<typeof techniqueFeedbackOutput>;

/** Keyframes of a student's clip (+ optional gold standard) → rubric scores and three tips (vision tier). */
export const techniqueFeedback: AiTask<TechniqueFeedbackInput, TechniqueFeedbackOutput> = {
  id: "technique_feedback",
  tier: "vision",
  description: "Technique feedback: rubric-scored review of a practice clip",
  input: techniqueFeedbackInput,
  output: techniqueFeedbackOutput,
  buildMessages: (i) => [
    { role: "system", content: `You are an experienced martial arts instructor reviewing still frames from a student's practice clip of "${i.skill}" (${i.category}). ${i.description ? `About the skill: ${i.description}. ` : ""}Score each rubric criterion from 1 (needs a lot of work) to 5 (excellent) with one specific, kind note based only on what the frames show; if a frame doesn't show something, say so instead of guessing. Then a two-sentence summary and exactly three concrete practice tips. An instructor reviews your feedback before the student sees it. Criteria: ${i.rubric.map((r) => `${r.criterion} (weight ${r.weight})`).join("; ")}.` },
    { role: "user", content: [
      { type: "text", text: `Student clip: ${i.frames.length} frames in order.` },
      ...i.frames.map((f) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${f}` } })),
      ...(i.goldFrames.length ? [{ type: "text" as const, text: `Instructor's reference performance: ${i.goldFrames.length} frames.` }, ...i.goldFrames.map((f) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${f}` } }))] : []),
    ] },
  ],
  maxCostCents: 25,
  temperature: 0.2,
  fixtureKey: (i) => ({ sha256: i.sha256, gold: i.goldFrames.length > 0 }),
};

/** Rubric used when a skill has none of its own, by category. */
export function defaultRubric(category: string): { criterion: string; weight: number }[] {
  const common = [{ criterion: "Stance and balance", weight: 30 }, { criterion: "Recovery and guard", weight: 20 }];
  if (category === "kick") return [{ criterion: "Chamber", weight: 25 }, { criterion: "Extension and target", weight: 25 }, ...common];
  if (category === "form") return [{ criterion: "Stances", weight: 30 }, { criterion: "Technique accuracy", weight: 30 }, { criterion: "Rhythm and focus", weight: 20 }, { criterion: "Balance", weight: 20 }];
  return [{ criterion: "Technique", weight: 50 }, ...common];
}

// ---------------------------------------------------------------- A12 Schedule suggestions
export const SUGGESTION_KINDS = ["add_section", "merge", "move", "no_show"] as const;
export const scheduleSuggestionInput = z.object({
  school: z.string(),
  kind: z.enum(SUGGESTION_KINDS),
  className: z.string(),
  weekday: z.string(),
  time: z.string(),
  utilization: z.number().min(0),
  waitlistPerSession: z.number().min(0),
  noShowRate: z.number().min(0).max(1),
  otherClass: z.string().nullable(),
});
export type ScheduleSuggestionInput = z.infer<typeof scheduleSuggestionInput>;
export const scheduleSuggestionOutput = z.object({
  /** Placeholders: {{class}}, {{day}}, {{time}}, {{utilization}}, {{waitlist}}, {{no_show}}, {{other_class}}. */
  title: z.string().min(5).max(120),
  rationale: z.string().min(10).max(400),
});

/**
 * The candidates (what to look at, and why) come from the numbers — utilization, waitlists, no-shows; the model
 * words the suggestion for the owner. Facts stay placeholders filled from the real stats.
 */
export const scheduleSuggestion: AiTask<ScheduleSuggestionInput, z.infer<typeof scheduleSuggestionOutput>> = {
  id: "schedule_suggestion",
  tier: "fast",
  description: "Schedule suggestions: word a data-backed timetable change",
  input: scheduleSuggestionInput,
  output: scheduleSuggestionOutput,
  buildMessages: (i) => [
    { role: "system", content: `Write one practical timetable suggestion for the owner of ${i.school}, a martial arts school: a short imperative title and a 1–2 sentence rationale. Use these placeholders for the facts (they're filled in): {{class}}, {{day}}, {{time}}, {{utilization}}, {{waitlist}}, {{no_show}}, {{other_class}}. Don't invent numbers.` },
    { role: "user", content: `Kind: ${i.kind}. Class ${i.className} on ${i.weekday} ${i.time}: ${Math.round(i.utilization * 100)}% full, ${i.waitlistPerSession.toFixed(1)} waitlisted per session, ${Math.round(i.noShowRate * 100)}% no-shows.${i.otherClass ? ` Related class: ${i.otherClass}.` : ""}` },
  ],
  maxCostCents: 1,
  temperature: 0.3,
  fixtureKey: (i) => ({ kind: i.kind }),
  examples: [{ school: "Ridgeline Taekwondo", kind: "add_section", className: "Little Dragons", weekday: "Saturday", time: "9:00 AM", utilization: 1, waitlistPerSession: 3.5, noShowRate: 0.05, otherClass: null }],
};
