import path from "node:path";

type Local = "owner" | "admin" | "frontdesk" | "instructor" | "assistant" | "parent" | "student";

/** Storage state saved by global-setup: `test.use({ storageState: authState("ridgeline", "owner") })`. */
export function authState(tenant: "ridgeline" | "harbor", local: Local): string {
  return path.resolve(import.meta.dirname, "..", ".auth", `${tenant}-${local}.json`);
}
