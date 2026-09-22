import { z } from "zod";

const urlField = z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a URL" });

const publicSchema = z.object({
  url: urlField,
  anonKey: z.string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" }).min(20, {
    error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is too short",
  }),
  cookieDomain: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
});

const serviceSchema = z.object({
  url: urlField,
  serviceRoleKey: z.string({ error: "SUPABASE_SERVICE_ROLE_KEY is missing" }).min(20, {
    error: "SUPABASE_SERVICE_ROLE_KEY is too short",
  }),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServiceEnv = z.infer<typeof serviceSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join("; ");
    throw new EnvError(`Invalid ${what} environment: ${issues}`);
  }
  return result.data;
}

/** Public Supabase env. `process.env.NEXT_PUBLIC_*` is referenced literally so Next inlines it client-side. */
export function publicEnv(
  input: { url?: string; anonKey?: string; cookieDomain?: string } = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
  },
): PublicEnv {
  return parse(publicSchema, input, "Supabase public");
}

export function serviceEnv(
  input: { url?: string; serviceRoleKey?: string } = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
): ServiceEnv {
  return parse(serviceSchema, input, "Supabase service");
}
