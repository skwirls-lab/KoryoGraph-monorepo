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
import { supplierSchema, type SupplierInput } from "@/lib/validation/retail";
import { saveSupplier } from "@/server/actions/retail";

const EMPTY: SupplierInput = { name: "", contactName: "", email: "", phone: "", website: "", notes: "", active: true };

export function SupplierDialog({ initial }: { initial?: SupplierInput }) {
  const [open, setOpen] = useState(false);
  const { form, pending, submit } = useActionForm({
    schema: supplierSchema,
    defaultValues: initial ?? EMPTY,
    action: saveSupplier,
    onSuccess: () => { toast.success("Supplier saved"); setOpen(false); if (!initial) form.reset(EMPTY); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{initial ? <Button size="sm" variant="outline" aria-label={`Edit ${initial.name}`}>Edit</Button> : <Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New supplier</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? `Edit ${initial.name}` : "New supplier"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <TextField form={form} name="name" label="Name" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField form={form} name="contactName" label="Contact" />
              <TextField form={form} name="phone" label="Phone" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField form={form} name="email" label="Email" type="email" />
              <TextField form={form} name="website" label="Website" />
            </div>
            <TextField form={form} name="notes" label="Notes" />
            <CheckboxField form={form} name="active" label="Active" />
            <FormError form={form} />
            <Button type="submit" disabled={pending}>Save supplier</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
