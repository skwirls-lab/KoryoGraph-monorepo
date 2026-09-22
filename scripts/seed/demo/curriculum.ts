import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import { insertChunks, type Rng } from "./rng";

export interface DemoRank { id: string; programKey: string; position: number; name: string; color: string; stripesMax: number; minClasses: number; minDays: number; skillIds: string[] }
export interface DemoProgram { key: string; id: string; name: string; ageMin: number | null; ageMax: number | null; inviteOnly: boolean; ranks: DemoRank[] }

const T = "ridgeline";
const tid = () => sid(`tenant:${T}`);

const LITTLE_TIGERS = [["White", "#f5f5f5"], ["White/Yellow", "#fde68a"], ["Yellow", "#facc15"], ["Orange", "#f97316"], ["Green", "#16a34a"], ["Blue", "#2563eb"], ["Red", "#dc2626"], ["Black tip", "#450a0a"]] as const;
const GUP = [["White belt (10th gup)", "#f5f5f5"], ["Yellow belt (9th gup)", "#facc15"], ["Orange belt (8th gup)", "#f97316"], ["Green belt (7th gup)", "#16a34a"], ["Purple belt (6th gup)", "#7c3aed"], ["Blue belt (5th gup)", "#2563eb"], ["Brown belt (4th gup)", "#92400e"], ["Red belt (3rd gup)", "#dc2626"], ["Red belt, black stripe (2nd gup)", "#b91c1c"], ["Black tip (1st gup)", "#450a0a"]] as const;

const SKILLS: Record<string, string[]> = {
  kick: ["Front snap kick", "Roundhouse kick", "Side kick", "Back kick", "Hook kick", "Axe kick", "Crescent kick (inside)", "Crescent kick (outside)", "Push kick", "Spinning hook kick", "Jump front kick", "Tornado kick", "Double roundhouse", "Skip side kick", "450 kick"],
  form: ["Taegeuk Il Jang", "Taegeuk Ee Jang", "Taegeuk Sam Jang", "Taegeuk Sa Jang", "Taegeuk Oh Jang", "Taegeuk Yuk Jang", "Taegeuk Chil Jang", "Taegeuk Pal Jang", "Koryo", "Keumgang", "Tiger form 1", "Tiger form 2", "Tiger form 3", "Tiger form 4"],
  one_step: Array.from({ length: 12 }, (_, i) => `One-step sparring #${i + 1}`),
  self_defense: ["Same-side wrist grab", "Cross wrist grab", "Two-hand wrist grab", "Front choke release", "Rear choke release", "Bear hug (front)", "Bear hug (rear)", "Hair grab release", "Shoulder grab", "Headlock escape", "Knife awareness", "Ground escape (mount)", "Ground escape (side)", "Push defence", "Stranger safety plan"],
  sparring: ["Fighting stance & footwork", "Jab-cross combination", "Roundhouse counter", "Fast kick drill", "Clinch break", "Ring awareness", "Point sparring rules", "Olympic scoring basics", "Cut kick timing", "Counter back kick", "Feint and switch", "Defensive blocking set", "Sparring etiquette", "Controlled light contact", "Endurance rounds"],
  breaking: ["Palm heel break", "Hammer fist break", "Front kick break", "Side kick break", "Back kick break", "Elbow strike break", "Speed break", "Two-board break"],
  terminology: ["Counting 1–10", "Commands (charyeot, kyungnet)", "Parts of the body", "Stances vocabulary", "Blocks vocabulary", "Strikes vocabulary", "Kicks vocabulary", "Tenets of Taekwondo", "History of Taekwondo", "Belt meanings", "Dojang etiquette", "Student oath", "Korean flag meaning", "Rank titles", "Judging terms"],
  conditioning: ["20 push-ups", "Flexibility: split progress", "Plank 60 s", "Jump rope 2 min", "Core circuit", "Stance holds", "Agility ladder", "Balance drills", "Kick endurance 50", "Shadow boxing 3 min"],
  other: ["Tiger listening skills", "Tiger balance game", "Tiger focus eyes", "Tiger respect bow", "Tiger kicking target", "Tiger rolling", "Tiger jumping jacks", "Tiger belt tying", "Tiger stranger danger", "Tiger teamwork", "Tiger counting", "Tiger stretching", "Tiger safe falling", "Tiger kiai", "Tiger courage"],
};

export async function seedCurriculum(ctx: SeedContext, rng: Rng): Promise<DemoProgram[]> {
  const defs = [
    { key: "little-tigers", name: "Little Tigers", ageMin: 4, ageMax: 6, inviteOnly: false, color: "#f59e0b", ladder: LITTLE_TIGERS.map(([n, c]) => ({ n, c, stripes: 4 })) },
    { key: "youth-tkd", name: "Youth Taekwondo", ageMin: 7, ageMax: 12, inviteOnly: false, color: "#e11d48", ladder: [...GUP.map(([n, c]) => ({ n, c, stripes: 3 })), { n: "1st poom (junior black belt)", c: "#111111", stripes: 0 }] },
    { key: "adult-tkd", name: "Adult Taekwondo", ageMin: 13, ageMax: null, inviteOnly: false, color: "#2563eb", ladder: [...GUP.map(([n, c]) => ({ n, c, stripes: 3 })), { n: "Black belt (1st dan)", c: "#111111", stripes: 0 }, { n: "Black belt (2nd dan)", c: "#111111", stripes: 0 }] },
    { key: "sparring-team", name: "Sparring Team", ageMin: 9, ageMax: null, inviteOnly: true, color: "#16a34a", ladder: [{ n: "Team member", c: "#16a34a", stripes: 0 }, { n: "Team captain", c: "#14532d", stripes: 0 }] },
    { key: "demo-team", name: "Demo Team", ageMin: 8, ageMax: null, inviteOnly: true, color: "#7c3aed", ladder: [{ n: "Demo team member", c: "#7c3aed", stripes: 0 }, { n: "Demo team lead", c: "#4c1d95", stripes: 0 }] },
  ];

  await insertChunks(ctx.sql, "programs", defs.map((d, i) => ({
    id: sid(`program:${T}:${d.key}`), tenant_id: tid(), name: d.name, slug: d.key, description: `${d.name} at Ridgeline Taekwondo.`,
    age_min: d.ageMin, age_max: d.ageMax, color: d.color, sort: (i + 1) * 10, active: true, invite_only: d.inviteOnly,
  })));

  // Skill library (~120) — shared except Little Tigers' own set.
  const skillRows: Record<string, unknown>[] = [];
  const skillIdsBy: Record<string, string[]> = {};
  let sort = 0;
  for (const [cat, names] of Object.entries(SKILLS)) {
    for (const name of names) {
      const id = sid(`skill:${T}:${cat}:${name}`);
      const tigers = cat === "other" || name.startsWith("Tiger form");
      skillRows.push({
        id, tenant_id: tid(), program_id: tigers ? sid(`program:${T}:little-tigers`) : null, category: tigers && cat === "form" ? "form" : cat,
        name, description: `${name}: demonstrated with correct technique, control and confidence.`, sort: (sort += 10),
        rubric: JSON.stringify([{ criterion: "Technique", weight: 0.5 }, { criterion: "Power & focus", weight: 0.3 }, { criterion: "Balance & control", weight: 0.2 }]),
      });
      (skillIdsBy[tigers ? "tigers" : cat] ??= []).push(id);
    }
  }
  await insertChunks(ctx.sql, "skills", skillRows.map((r) => ({ ...r, rubric: ctx.sql.json(JSON.parse(r.rubric as string)) })));

  const programs: DemoProgram[] = [];
  const rankRows: Record<string, unknown>[] = [];
  const reqRows: Record<string, unknown>[] = [];
  const rankSkillRows: Record<string, unknown>[] = [];
  for (const d of defs) {
    const ranks: DemoRank[] = [];
    d.ladder.forEach((l, i) => {
      const position = i + 1;
      const id = sid(`rank:${T}:${d.key}:${position}`);
      const team = d.inviteOnly;
      const minClasses = position === 1 || team ? 0 : Math.min(40, 14 + position * 2 + (d.key === "adult-tkd" ? 4 : 0));
      const minDays = position === 1 || team ? 0 : Math.min(180, 50 + position * 7 + (l.c === "#111111" ? 60 : 0));
      // 3–8 required skills per rank from categories that fit the program.
      const skillIds: string[] = [];
      if (position > 1 && !team) {
        const n = Math.min(8, 3 + Math.floor(position / 2));
        const pools = d.key === "little-tigers" ? ["tigers", "kick", "terminology"] : ["kick", "form", "one_step", "self_defense", "terminology", ...(position > 4 ? ["sparring", "breaking"] : [])];
        const formIdx = Math.min((skillIdsBy.form ?? []).length - 1, Math.max(0, position - 2));
        if (d.key !== "little-tigers" && skillIdsBy.form?.[formIdx]) skillIds.push(skillIdsBy.form[formIdx] as string);
        while (skillIds.length < n) {
          const pool = skillIdsBy[rng.pick(pools)] ?? [];
          const s = pool[Math.min(pool.length - 1, Math.floor(((position - 1) / d.ladder.length) * pool.length) + rng.int(0, 2))];
          if (s && !skillIds.includes(s)) skillIds.push(s);
        }
      }
      ranks.push({ id, programKey: d.key, position, name: l.n, color: l.c, stripesMax: l.stripes, minClasses, minDays, skillIds });
      rankRows.push({ id, tenant_id: tid(), program_id: sid(`program:${T}:${d.key}`), name: l.n, belt_color: l.c, position, stripes_max: l.stripes, testing_fee_cents: team || position === 1 ? 0 : l.c === "#111111" ? 15000 : 4500 });
      if (position > 1 && !team) reqRows.push({ id: sid(`req:${id}`), tenant_id: tid(), rank_id: id, min_classes: minClasses, min_days: minDays, requires_instructor_approval: l.c === "#111111" || position >= d.ladder.length - 1 });
      for (const s of skillIds) rankSkillRows.push({ id: sid(`rank_skill:${id}:${s}`), tenant_id: tid(), rank_id: id, skill_id: s, required: true });
    });
    programs.push({ key: d.key, id: sid(`program:${T}:${d.key}`), name: d.name, ageMin: d.ageMin, ageMax: d.ageMax, inviteOnly: d.inviteOnly, ranks });
  }
  await insertChunks(ctx.sql, "ranks", rankRows);
  await insertChunks(ctx.sql, "rank_requirements", reqRows);
  await insertChunks(ctx.sql, "rank_skills", rankSkillRows);

  await insertChunks(ctx.sql, "lesson_plans", [
    { id: sid(`lesson:${T}:youth-standard`), tenant_id: tid(), program_id: sid(`program:${T}:youth-tkd`), name: "Youth standard class", is_template: true, source: "manual",
      sections: ctx.sql.json([{ title: "Warm-up", minutes: 10, skill_ids: [], notes: "Jog, jumping jacks, dynamic stretches" }, { title: "Kicks", minutes: 15, skill_ids: (skillIdsBy.kick ?? []).slice(0, 3), notes: "" }, { title: "Forms", minutes: 10, skill_ids: (skillIdsBy.form ?? []).slice(0, 2), notes: "" }, { title: "Sparring drills", minutes: 15, skill_ids: (skillIdsBy.sparring ?? []).slice(0, 2), notes: "Light contact, gear on" }, { title: "Cool-down", minutes: 5, skill_ids: [], notes: "Stretch, bow out" }]) },
    { id: sid(`lesson:${T}:tigers-standard`), tenant_id: tid(), program_id: sid(`program:${T}:little-tigers`), name: "Little Tigers class", is_template: true, source: "manual",
      sections: ctx.sql.json([{ title: "Tiger warm-up game", minutes: 8, skill_ids: [], notes: "" }, { title: "Tiger skills", minutes: 15, skill_ids: (skillIdsBy.tigers ?? []).slice(0, 3), notes: "" }, { title: "Kicking targets", minutes: 12, skill_ids: [], notes: "" }, { title: "Listening circle", minutes: 5, skill_ids: [], notes: "" }]) },
  ]);
  return programs;
}
