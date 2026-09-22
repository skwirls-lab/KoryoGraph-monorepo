"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@koryo/ui/components/ui/tabs";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { loginSchema, magicLinkSchema } from "@/lib/validation/auth";
import { sendMagicLink, signInWithGoogle, signInWithPassword } from "@/server/auth/actions";

export function LoginForm({ next, googleEnabled }: { next?: string; googleEnabled: boolean }) {
  const password = useActionForm({ schema: loginSchema, defaultValues: { email: "", password: "", next }, action: signInWithPassword });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const magic = useActionForm({
    schema: magicLinkSchema,
    defaultValues: { email: "", next },
    action: sendMagicLink,
    onSuccess: (_d, v) => setSentTo(v.email),
  });
  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="password">
        <TabsList className="w-full">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="magic">Email me a link</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="pt-4">
          <Form {...password.form}>
            <form onSubmit={password.submit} className="space-y-4" noValidate>
              <TextField form={password.form} name="email" label="Email" type="email" autoComplete="email" />
              <TextField form={password.form} name="password" label="Password" type="password" autoComplete="current-password" />
              <FormError form={password.form} />
              <Button type="submit" className="w-full" disabled={password.pending}>
                {password.pending ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-right text-sm">
                <Link href="/forgot-password">Forgot password?</Link>
              </p>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="magic" className="pt-4">
          {sentTo ? (
            <p role="status" className="rounded-md border border-default bg-elevated p-4 text-sm">
              If <strong>{sentTo}</strong> has an account, a sign-in link is on its way. It expires in one hour.
            </p>
          ) : (
            <Form {...magic.form}>
              <form onSubmit={magic.submit} className="space-y-4" noValidate>
                <TextField form={magic.form} name="email" label="Email" type="email" autoComplete="email" />
                <FormError form={magic.form} />
                <Button type="submit" className="w-full" disabled={magic.pending}>
                  {magic.pending ? "Sending…" : "Send sign-in link"}
                </Button>
              </form>
            </Form>
          )}
        </TabsContent>
      </Tabs>
      {googleEnabled ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={googlePending}
            onClick={() =>
              startGoogle(async () => {
                const r = await signInWithGoogle(next);
                if (!r.ok) setGoogleError(r.error);
              })
            }
          >
            Continue with Google
          </Button>
          {googleError ? <p role="alert" className="text-sm text-danger">{googleError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
