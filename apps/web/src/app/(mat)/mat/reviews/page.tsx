import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ReviewQueue, type ReviewItem } from "@/components/technique/review-queue";
import { displayName } from "@/lib/people";
import { techniquePayloadSchema } from "@/lib/technique";
import { requireModule, requireSurfacePage } from "@/server/context";

export const metadata = { title: "Technique reviews" };

export default async function MatReviews() {
  const ctx = await requireSurfacePage("mat");
  requireModule(ctx, "vision");
  if (!ctx.permissions.has("ai.approve") || !ctx.permissions.has("attendance.write")) forbidden();
  const { data: pending } = await ctx.supabase.from("approval_items")
    .select("id, title, payload, entity_id, person_id, people(first_name, last_name, preferred_name), ai_transport")
    .eq("kind", "vision_feedback").eq("status", "pending").order("created_at").limit(30);
  const subIds = (pending ?? []).map((p) => p.entity_id).filter((x): x is string => Boolean(x));
  const { data: subs } = subIds.length
    ? await ctx.supabase.from("technique_submissions").select("id, keyframe_paths, video_path, note").in("id", subIds)
    : { data: [] };
  const paths = (subs ?? []).flatMap((s) => [...s.keyframe_paths, s.video_path]);
  const { data: signed } = paths.length ? await ctx.supabase.storage.from("tenant-media").createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  const items: ReviewItem[] = [];
  for (const p of pending ?? []) {
    const payload = techniquePayloadSchema.safeParse(p.payload);
    const sub = (subs ?? []).find((s) => s.id === p.entity_id);
    if (!payload.success || !sub || !p.person_id) continue;
    items.push({
      id: p.id, title: p.title, personId: p.person_id, studentName: p.people ? displayName(p.people) : "Student", payload: payload.data,
      frames: sub.keyframe_paths.map((k) => url.get(k)).filter((x): x is string => Boolean(x)), videoUrl: url.get(sub.video_path) ?? null,
      note: sub.note, fixture: p.ai_transport === "fixture",
    });
  }
  return (
    <>
      <PageHeader title="Technique reviews" description="AI feedback on students' practice clips. Check it, adjust it, then release it — students see nothing until you do." />
      <ReviewQueue items={items} />
    </>
  );
}
