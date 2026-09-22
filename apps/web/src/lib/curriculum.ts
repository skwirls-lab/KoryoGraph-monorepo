export const SKILL_CATEGORIES = ["kick", "form", "one_step", "self_defense", "sparring", "breaking", "terminology", "conditioning", "other"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  kick: "Kicks",
  form: "Forms",
  one_step: "One-steps",
  self_defense: "Self-defense",
  sparring: "Sparring",
  breaking: "Breaking",
  terminology: "Terminology",
  conditioning: "Conditioning",
  other: "Other",
};

export interface RubricRow {
  criterion: string;
  weight: number;
}

export interface LessonSection {
  title: string;
  minutes: number;
  skill_ids: string[];
  notes: string;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "program";
}

/** "45.00" / "45" / "$45" → 4500 cents; invalid → null. */
export function parseMoney(input: string): number | null {
  const v = input.replace(/[$,\s]/g, "");
  if (v === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
