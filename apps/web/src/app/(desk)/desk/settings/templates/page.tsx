import { SYSTEM_TEMPLATES } from "@koryo/comms";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { TemplateEditor, type EditableTemplate } from "@/components/settings/template-editor";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Message templates" };

export default async function TemplatesSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  const { data: overrides } = await ctx.supabase.from("message_templates").select("key, channel, subject, body");
  const items: EditableTemplate[] = Object.values(SYSTEM_TEMPLATES).flatMap((t) =>
    (Object.entries(t.channels) as [EditableTemplate["channel"], { subject?: string; body: string }][])
      .filter(([c]) => c !== ("push" as string))
      .map(([channel, c]) => {
        const o = (overrides ?? []).find((x) => x.key === t.key && x.channel === channel);
        return {
          key: t.key, channel, description: t.description, variables: t.variables,
          subject: o?.subject ?? c.subject ?? "", body: o?.body ?? c.body, overridden: Boolean(o),
          defaultSubject: c.subject ?? "", defaultBody: c.body,
        };
      }),
  );
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Message templates" description="Customise what families receive. Unchanged templates use KoryoGraph's defaults." />
      <div className="space-y-4">
        {items.map((t) => <TemplateEditor key={`${t.key}-${t.channel}`} t={t} canEdit={ctx.permissions.has("automations.manage")} />)}
      </div>
    </>
  );
}
