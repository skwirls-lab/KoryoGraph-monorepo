export const API_RESOURCES = ["people", "attendance", "invoices", "memberships"] as const;
export type ApiResource = (typeof API_RESOURCES)[number];
export const API_SCOPES = API_RESOURCES.map((r) => `${r}:read`);
export const WEBHOOK_EVENTS = ["member.created", "attendance.created", "invoice.paid"] as const;

/** Filters each list endpoint accepts (query string → api_list filters). */
export const API_FILTERS: Record<ApiResource, string[]> = {
  people: ["status", "type", "updated_since"],
  attendance: ["person_id", "since", "until"],
  invoices: ["status", "since"],
  memberships: ["status", "person_id"],
};
