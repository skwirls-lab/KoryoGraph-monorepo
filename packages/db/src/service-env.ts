import "server-only";
import { z } from "zod";
import { parse } from "./public-env";

const urlField = z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a URL" });
const serviceSchema = z.object({
  url: urlField,
  serviceRoleKey: z.string({ error: "SUPABASE_SERVICE_ROLE_KEY is missing" }).min(20, {
    error: "SUPABASE_SERVICE_ROLE_KEY is too short",
  }),
});
export type ServiceEnv = z.infer<typeof serviceSchema>;

export function serviceEnv(
  input: { url?: string; serviceRoleKey?: string } = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
): ServiceEnv {
  return parse(serviceSchema, input, "Supabase service");
}
