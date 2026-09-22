import { z } from "zod";
import { email, password } from "./auth";

export const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, { error: "Choose a valid timezone" });

export const schoolSchema = z.object({
  schoolName: z.string().trim().min(2, { error: "Enter your school's name" }).max(80),
  timezone,
});
export type SchoolInput = z.infer<typeof schoolSchema>;

export const signupSchema = schoolSchema.extend({
  fullName: z.string().trim().min(2, { error: "Enter your name" }).max(80),
  email,
  password,
});
export type SignupInput = z.infer<typeof signupSchema>;
