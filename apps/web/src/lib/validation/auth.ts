import { z } from "zod";

export const email = z.email({ error: "Enter a valid email address" }).trim().toLowerCase();
export const password = z.string().min(8, { error: "Use at least 8 characters" }).max(128);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }),
  next: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({ email, next: z.string().optional() });
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "Passwords don't match", path: ["confirm"] });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
