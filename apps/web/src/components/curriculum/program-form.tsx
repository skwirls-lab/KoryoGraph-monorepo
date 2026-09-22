"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { programSchema, type ProgramInput } from "@/lib/validation/curriculum";
import { saveProgram } from "@/server/actions/curriculum";

function ProgramFields({ initial, onDone }: { initial: ProgramInput; onDone?: () => void }) {
  const { form, pending, submit } = useActionForm({
    schema: programSchema,
    defaultValues: initial,
    action: saveProgram,
    onSuccess: () => { toast.success("Program saved"); onDone?.(); },
  });
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField form={form} name="name" label="Program name" placeholder="Youth Taekwondo" />
        <TextField form={form} name="description" label="Description" />
        <div className="grid grid-cols-3 gap-3">
          <TextField form={form} name="ageMin" label="Min age" type="number" min={0} />
          <TextField form={form} name="ageMax" label="Max age" type="number" min={0} />
          <TextField form={form} name="color" label="Colour" type="color" className="h-9 p-1" />
        </div>
        <div className="flex flex-wrap gap-4">
          <CheckboxField form={form} name="inviteOnly" label="Invite only (e.g. demo team)" />
          <CheckboxField form={form} name="active" label="Active" />
        </div>
        <FormError form={form} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save program" : "Create program"}</Button>
      </form>
    </Form>
  );
}

export function NewProgramDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New program</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New program</DialogTitle></DialogHeader>
        <ProgramFields initial={{ name: "", description: "", ageMin: "", ageMax: "", color: "#e11d48", inviteOnly: false, active: true }} />
      </DialogContent>
    </Dialog>
  );
}

export function EditProgramDialog({ initial }: { initial: ProgramInput }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Edit program</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit program</DialogTitle></DialogHeader>
        <ProgramFields initial={initial} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
