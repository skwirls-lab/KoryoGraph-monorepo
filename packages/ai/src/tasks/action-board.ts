import { z } from "zod";
import type { AiTask } from "../types";

export const transcribeInput = z.object({ audioBase64: z.string().min(10), format: z.enum(["wav", "mp3"]), sha256: z.string().length(64) });
export type TranscribeInput = z.infer<typeof transcribeInput>;
export const transcribeOutput = z.object({ transcript: z.string().min(1).max(200_000) });

/** Class audio → plain transcript (audio tier). */
export const transcribe: AiTask<TranscribeInput, z.infer<typeof transcribeOutput>> = {
  id: "transcribe",
  tier: "audio",
  description: "Transcribe a class recording",
  input: transcribeInput,
  output: transcribeOutput,
  buildMessages: (i) => [
    { role: "user", content: [
      { type: "text", text: "Transcribe this martial arts class recording verbatim. Return JSON {\"transcript\": \"…\"} with speaker changes on new lines." },
      { type: "input_audio", input_audio: { data: i.audioBase64, format: i.format } },
    ] },
  ],
  maxCostCents: 60,
  temperature: 0,
  fixtureKey: (i) => ({ sha256: i.sha256 }),
};

const confidence = z.number().min(0).max(1);
export const actionBoardInput = z.object({
  className: z.string(),
  transcript: z.string().min(1).max(200_000),
  roster: z.array(z.object({ personId: z.string(), name: z.string() })).max(80),
  skills: z.array(z.object({ id: z.string(), name: z.string() })).max(300),
});
export type ActionBoardInput = z.infer<typeof actionBoardInput>;
export const actionBoardOutput = z.object({
  attendance: z.array(z.object({ personId: z.string(), evidence: z.string().max(300), confidence })).max(80),
  skillNotes: z.array(z.object({ personId: z.string(), skillId: z.string().nullable(), note: z.string().max(500), signOff: z.boolean(), confidence })).max(80),
  injuries: z.array(z.object({ personId: z.string(), note: z.string().max(500), confidence })).max(20),
  followUps: z.array(z.object({ title: z.string().max(200), personId: z.string().nullable() })).max(20),
});
export type ActionBoardOutput = z.infer<typeof actionBoardOutput>;

/** Transcript + roster + skills → draft attendance, skill notes/sign-offs, injuries and follow-ups (frontier). */
export const actionBoard: AiTask<ActionBoardInput, ActionBoardOutput> = {
  id: "action_board",
  tier: "frontier",
  description: "Post-class action board from a transcript",
  input: actionBoardInput,
  output: actionBoardOutput,
  buildMessages: (i) => [
    { role: "system", content: `You turn a transcript of the martial arts class "${i.className}" into a draft action board for the instructor to approve. Match names heard to the roster (people may be called by first name or nickname) and use only roster personIds and listed skill ids — never invent ids. If a skill mentioned isn't in the list, set skillId to null. Mark signOff true only when the instructor clearly says a student has passed or mastered a skill. Give a confidence 0–1 for each row; use < 0.7 when a name match or statement is uncertain. Include an injury only when one is mentioned. Follow-ups are concrete tasks for staff.
Roster:\n${i.roster.map((r) => `${r.personId}: ${r.name}`).join("\n")}
Skills:\n${i.skills.map((s) => `${s.id}: ${s.name}`).join("\n")}` },
    { role: "user", content: i.transcript },
  ],
  maxCostCents: 40,
  temperature: 0,
  fixtureKey: (i) => ({ transcript: i.transcript.trim() }),
};
