import { NextResponse } from "next/server";
import { API_FILTERS, API_RESOURCES } from "@/lib/public-api";

const FIELDS: Record<string, Record<string, string>> = {
  people: { id: "uuid", first_name: "string", last_name: "string", preferred_name: "string", email: "string", phone: "string", dob: "date", status: "string", type_flags: "array", external_id: "string", created_at: "date-time", updated_at: "date-time" },
  attendance: { id: "uuid", person_id: "uuid", session_id: "uuid", class_name: "string", starts_at: "date-time", checked_in_at: "date-time", source: "string", created_at: "date-time" },
  invoices: { id: "uuid", number: "integer", household_id: "uuid", person_id: "uuid", status: "string", total_cents: "integer", paid_cents: "integer", balance_cents: "integer", currency: "string", due_at: "date", issued_at: "date-time", created_at: "date-time" },
  memberships: { id: "uuid", person_id: "uuid", household_id: "uuid", plan_id: "uuid", plan_name: "string", status: "string", starts_at: "date", ends_at: "date", next_bill_at: "date", created_at: "date-time" },
};
const prop = (t: string) => (t === "uuid" ? { type: "string", format: "uuid" } : t === "date" || t === "date-time" ? { type: "string", format: t } : t === "array" ? { type: "array", items: { type: "string" } } : { type: t });

/** OpenAPI 3.1 description of the read-only v1 API. */
export function GET() {
  const doc = {
    openapi: "3.1.0",
    info: { title: "KoryoGraph API", version: "1.0.0", description: "Read-only access to your school's data. Create keys in Desk → Settings → API. 120 requests per minute per key." },
    servers: [{ url: `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "")}/api/v1` }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "kg_live_… API key" } },
      schemas: Object.fromEntries(API_RESOURCES.map((r) => [r, { type: "object", properties: Object.fromEntries(Object.entries(FIELDS[r] ?? {}).map(([k, t]) => [k, prop(t)])) }])),
    },
    security: [{ bearer: [] }],
    paths: Object.fromEntries(API_RESOURCES.map((r) => [`/${r}`, { get: {
      summary: `List ${r}`, operationId: `list_${r}`,
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        { name: "cursor", in: "query", schema: { type: "string" }, description: "next_cursor from the previous page" },
        ...(API_FILTERS[r] ?? []).map((f) => ({ name: f, in: "query", schema: { type: "string" } })),
      ],
      responses: {
        200: { description: "A page", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: `#/components/schemas/${r}` } }, next_cursor: { type: ["string", "null"] } } } } } },
        401: { description: "Missing or invalid key" }, 403: { description: "Key lacks the scope" }, 429: { description: "Rate limited" },
      },
    } }])),
    webhooks: Object.fromEntries(["member.created", "attendance.created", "invoice.paid"].map((e) => [e, { post: {
      summary: `${e} event`, description: "Signed: KoryoGraph-Signature: t=<unix>,v1=<hex HMAC-SHA256 of `${t}.${body}` with your endpoint secret>. Retried with backoff for ~15 hours.",
      responses: { 200: { description: "Any 2xx acknowledges delivery" } },
    } }])),
  };
  return NextResponse.json(doc, { headers: { "cache-control": "public, max-age=300" } });
}
