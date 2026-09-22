import { z } from "zod";
import { SKILL_CATEGORIES } from "../curriculum";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Pick a colour" });

export const programSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the program" }).max(80),
  description: z.string().trim().max(1000).default(""),
  ageMin: z.coerce.number().int().min(0).max(120).optional().or(z.literal("")),
  ageMax: z.coerce.number().int().min(0).max(120).optional().or(z.literal("")),
  color: hex,
  inviteOnly: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type ProgramInput = z.input<typeof programSchema>;

export const rankSchema = z.object({
  id: z.uuid().optional(),
  programId: z.uuid(),
  name: z.string().trim().min(1, { error: "Name the rank" }).max(80),
  beltColor: hex,
  stripesMax: z.coerce.number().int().min(0).max(10),
  testingFee: z.string().trim().default("0"),
});
export type RankInput = z.input<typeof rankSchema>;

export const requirementSchema = z.object({
  rankId: z.uuid(),
  minClasses: z.coerce.number().int().min(0).max(1000),
  minDays: z.coerce.number().int().min(0).max(3650),
  requiresApproval: z.boolean(),
  notes: z.string().trim().max(1000).default(""),
  skillIds: z.array(z.uuid()).max(200),
});
export type RequirementInput = z.input<typeof requirementSchema>;

export const skillSchema = z.object({
  id: z.uuid().optional(),
  programId: z.uuid().optional().or(z.literal("")),
  category: z.enum(SKILL_CATEGORIES),
  name: z.string().trim().min(2, { error: "Name the skill" }).max(120),
  description: z.string().trim().max(4000).default(""),
  videoUrl: z.url({ protocol: /^https?$/, error: "Use an http(s) link" }).optional().or(z.literal("")),
  rubric: z.array(z.object({ criterion: z.string().trim().min(1).max(80), weight: z.coerce.number().min(0).max(1) })).max(12),
});
export type SkillInput = z.input<typeof skillSchema>;

export const lessonPlanSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the plan" }).max(120),
  programId: z.uuid().optional().or(z.literal("")),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1, { error: "Section title" }).max(80),
        minutes: z.coerce.number().int().min(0).max(240),
        skill_ids: z.array(z.uuid()).max(50),
        notes: z.string().trim().max(2000).default(""),
      }),
    )
    .min(1, { error: "Add at least one section" })
    .max(20),
});
export type LessonPlanInput = z.input<typeof lessonPlanSchema>;
