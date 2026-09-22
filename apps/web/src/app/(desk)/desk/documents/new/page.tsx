import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { DocumentForm } from "@/components/documents/document-form";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "New document" };

const STARTER = `# Liability waiver

I, {{guardian_name}}, am the parent or legal guardian of {{student_name}} and give permission for them to take part in martial arts classes at {{school_name}}.

I understand that martial arts training involves physical contact and a risk of injury, including:
- bruises, sprains and strains
- injuries from falls and contact with other students

I confirm {{student_name}} is in good health and I will tell the school about any medical condition or injury.

Signed on {{date}}.`;

export default async function NewDocumentPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const { data: programs } = await ctx.supabase.from("programs").select("id, name").eq("active", true).order("name");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/documents">Documents</Link>} title="New document" description="This is a starting draft — have your own waiver reviewed by a lawyer." />
      <DocumentForm initial={{ name: "Liability waiver", kind: "waiver", body: STARTER, allStudents: true, programIds: [] }} programs={programs ?? []} submitLabel="Publish" />
    </>
  );
}
