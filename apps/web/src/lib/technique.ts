import { z } from "zod";

/** Largest practice clip accepted (storage limit); clips are ≤ 60 s. */
export const MAX_CLIP_BYTES = 50 * 1024 * 1024;

export const techniqueFeedbackSchema = z.object({
  scores: z.array(z.object({ criterion: z.string().min(1).max(80), score: z.number().int().min(1).max(5), note: z.string().trim().min(1).max(240), weight: z.number().min(0).max(100).optional() })).min(1).max(8),
  /** Weighted by the skill's rubric (computed, not model-written). */
  overall: z.number().min(1).max(5),
  summary: z.string().trim().min(5).max(500),
  tips: z.array(z.string().trim().min(3).max(200)).length(3),
});
export type TechniqueFeedback = z.infer<typeof techniqueFeedbackSchema>;

export const techniquePayloadSchema = z.object({
  submission_id: z.uuid(),
  person_id: z.uuid(),
  skill: z.string(),
  feedback: techniqueFeedbackSchema,
});
export type TechniquePayload = z.infer<typeof techniquePayloadSchema>;

/** Rubric-weighted 1–5 score (weights may be fractions or percentages). */
export function weightedOverall(scores: { criterion: string; score: number }[], rubric: { criterion: string; weight: number }[]): number {
  const w = new Map(rubric.map((r) => [r.criterion.toLowerCase(), r.weight]));
  let sum = 0;
  let total = 0;
  for (const s of scores) {
    const weight = w.get(s.criterion.toLowerCase()) ?? 0;
    sum += s.score * weight;
    total += weight;
  }
  const v = total > 0 ? sum / total : scores.reduce((a, s) => a + s.score, 0) / Math.max(1, scores.length);
  return Math.round(v * 10) / 10;
}
