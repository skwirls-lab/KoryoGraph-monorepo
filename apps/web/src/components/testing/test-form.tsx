"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { FormError } from "@/components/forms/form-error";
import { MultiCheckField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { testingEventSchema, type TestingEventInput } from "@/lib/validation/testing";
import { saveTestingEvent } from "@/server/actions/testing";

export function TestDialog({ initial, programs, staff }: { initial?: TestingEventInput; programs: { value: string; label: string }[]; staff: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { form, pending, submit } = useActionForm({
    schema: testingEventSchema,
    defaultValues: initial ?? { name: "", date: "", time: "10:00", durationMin: 120, programIds: [], fee: "", deadline: "", capacity: "", judgeIds: [], notes: "" },
    action: saveTestingEvent,
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{initial ? <Button size="sm" variant="outline">Edit test</Button> : <Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New test</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit belt test" : "New belt test"}</DialogTitle>
          <DialogDescription>Students in these programs are checked against their next rank&apos;s requirements.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <TextField form={form} name="name" label="Name" placeholder="Color belt test — October" />
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField form={form} name="date" label="Date" type="date" />
              <TextField form={form} name="time" label="Start time" type="time" />
              <TextField form={form} name="durationMin" label="Length (min)" type="number" min={15} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField form={form} name="fee" label="Testing fee" inputMode="decimal" placeholder="45.00" />
              <TextField form={form} name="deadline" label="Register by" type="date" />
              <TextField form={form} name="capacity" label="Capacity" type="number" min={1} />
            </div>
            <MultiCheckField form={form} name="programIds" legend="Programs" options={programs} />
            <MultiCheckField form={form} name="judgeIds" legend="Judges" options={staff} />
            <TextField form={form} name="notes" label="Notes" />
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save" : "Create test"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
