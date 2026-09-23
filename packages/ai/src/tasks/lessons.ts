import { z } from "zod";
import type { AiTask } from "../types";

export const lessonBuilderInput = z.object({
  prompt: z.string().trim().min(5).max(1000),
  programName: z.string(),
  rankBand: z.array(z.string()).max(20),
  weeks: z.number().int().min(1).max(12),
  classMinutes: z.number().int().min(15).max(180),
  skills: z.array(z.object({ id: z.string(), name: z.string(), category: z.string() })).max(400),
});
export type LessonBuilderInput = z.infer<typeof lessonBuilderInput>;

export const lessonBuilderOutput = z.object({
  plans: z.array(z.object({
    name: z.string().min(2).max(120),
    week: z.number().int().min(1).max(12),
    sections: z.array(z.object({ title: z.string().min(1).max(80), minutes: z.number().int().min(1).max(120), skillIds: z.array(z.string()).max(12), notes: z.string().max(1500) })).min(1).max(10),
  })).min(1).max(12),
  /** Skills the plan needs that aren't in the library (never invented ids). */
  suggestedSkills: z.array(z.object({ name: z.string().max(80), category: z.string().max(30), reason: z.string().max(300) })).max(10),
});
export type LessonBuilderOutput = z.infer<typeof lessonBuilderOutput>;

/** Instructor prompt → week-by-week lesson plans that reference only the school's own skills (A5). */
export const lessonBuilder: AiTask<LessonBuilderInput, LessonBuilderOutput> = {
  id: "lesson_builder",
  tier: "frontier",
  description: "Curriculum & lesson builder",
  input: lessonBuilderInput,
  output: lessonBuilderOutput,
  buildMessages: (i) => [
    { role: "system", content: `You are an experienced martial arts curriculum designer. Plan ${i.weeks} week${i.weeks === 1 ? "" : "s"} of ${i.classMinutes}-minute classes for ${i.programName}${i.rankBand.length ? ` (ranks: ${i.rankBand.join(", ")})` : ""}: one plan per week, sections that add up to about ${i.classMinutes} minutes (warm-up, technique, drills, application, cool-down). Reference skills only by the ids below; never invent ids. If the plan needs a skill that isn't listed, put it in suggestedSkills instead.
Skill library:\n${i.skills.map((s) => `${s.id}: ${s.name} (${s.category})`).join("\n")}` },
    { role: "user", content: i.prompt },
  ],
  maxCostCents: 40,
  temperature: 0.4,
  fixtureKey: (i) => ({ prompt: i.prompt.trim().toLowerCase().replace(/\s+/g, " "), weeks: i.weeks, program: i.programName }),
};
