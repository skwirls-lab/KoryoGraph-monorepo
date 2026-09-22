import { redirect } from "next/navigation";
import { getOptionalCtx, landingPath } from "@/server/context";

/**
 * Sends a signed-in user to the surface their role opens (desk → mat → home), else /welcome.
 * A page (not a route handler) so it works for both full loads and client-side redirects.
 */
export default async function LandingRedirect() {
  const ctx = await getOptionalCtx();
  redirect(ctx ? landingPath(ctx) : "/login");
}
