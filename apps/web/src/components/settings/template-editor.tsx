"use client";

import { render } from "@koryo/comms";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { resetTemplateOverride, saveTemplateOverride } from "@/server/actions/messaging";

export interface EditableTemplate {
  key: string;
  channel: "email" | "sms" | "inapp";
  description: string;
  variables: string[];
  subject: string;
  body: string;
  overridden: boolean;
  defaultSubject: string;
  defaultBody: string;
}

const SAMPLE: Record<string, string> = {
  first_name: "Morgan", student_name: "Maya", class_name: "Youth Taekwondo", class_time: "Wed, Sep 23, 5:00 PM",
  reason: "Instructor at tournament", reason_suffix: " (Instructor at tournament)", school_name: "Ridgeline Taekwondo",
  message: "Bring your sparring gear on Wednesday.", sender_name: "Sabumnim Grace", preview: "Thanks — see you Saturday!",
};

export function TemplateEditor({ t, canEdit }: { t: EditableTemplate; canEdit: boolean }) {
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [pending, start] = useTransition();
  const id = `${t.key}-${t.channel}`;
  const preview = render(`${t.channel === "email" ? `Subject: ${subject}\n\n` : ""}${body}`, SAMPLE);
  return (
    <section className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-label={`${t.key} ${t.channel}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{t.key.replace(/_/g, " ")}</h2>
        <Badge variant="outline">{t.channel}</Badge>
        {t.overridden ? <Badge>Customised</Badge> : null}
        <span className="text-sm text-fg-secondary">{t.description}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {t.channel === "email" ? (<div className="space-y-1"><Label htmlFor={`${id}-s`}>Subject</Label><Input id={`${id}-s`} value={subject} disabled={!canEdit} onChange={(e) => setSubject(e.target.value)} /></div>) : null}
          <div className="space-y-1"><Label htmlFor={`${id}-b`}>Message</Label><Textarea id={`${id}-b`} rows={6} value={body} disabled={!canEdit} onChange={(e) => setBody(e.target.value)} /></div>
          <p className="text-xs text-fg-muted">Merge fields: {t.variables.map((v) => `{{${v}}}`).join(" ")}</p>
          {canEdit ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await saveTemplateOverride({ key: t.key, channel: t.channel, subject, body }); if (r.ok) toast.success("Template saved"); else toast.error(r.error); })}>Save</Button>
              {t.overridden ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await resetTemplateOverride({ key: t.key, channel: t.channel }); if (r.ok) { setSubject(t.defaultSubject); setBody(t.defaultBody); toast.success("Back to the default"); } else toast.error(r.error); })}>Reset to default</Button> : null}
            </div>
          ) : null}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Preview (sample data)</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-elevated p-3 font-sans text-sm" aria-label={`Preview of ${t.key} ${t.channel}`}>{preview.text}</pre>
          {preview.missing.length ? <p className="mt-1 text-xs text-warning">Unknown fields: {preview.missing.join(", ")}</p> : null}
        </div>
      </div>
    </section>
  );
}
