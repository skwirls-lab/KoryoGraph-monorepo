import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const H = sid("tenant:harbor");
const started = new Date();
const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
let server: Server;
let port = 0;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => { body += c.toString(); });
    req.on("end", () => { received.push({ headers: req.headers, body }); res.writeHead(200).end("ok"); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

test.afterAll(async () => {
  server.close();
  await sql`delete from webhook_endpoints where tenant_id = ${R} and created_at >= ${started}`;
  await sql`delete from api_keys where tenant_id in (${R}, ${H}) and created_at >= ${started}`;
  await sql`delete from people where tenant_id = ${R} and last_name = 'Webhookson'`;
});

test.describe("@m5 public API and webhooks", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("key → GET people returns only that school's people (paged); another school's key sees none of them; webhook delivered signed", async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.goto("/desk/settings/api");
    await page.getByLabel("Key name").fill("Spec key");
    await page.getByRole("button", { name: "Create key" }).click();
    const key = (await page.getByTestId("new-api-key").textContent())?.trim() ?? "";
    expect(key).toMatch(/^kg_live_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$/);
    await expectNoSeriousA11yViolations(page);
    const [stored] = await sql<{ key_hash: string }[]>`select key_hash from api_keys where tenant_id = ${R} and name = 'Spec key'`;
    expect(stored?.key_hash).toBe(createHash("sha256").update(key).digest("hex")); // only the hash is stored

    const get = (path: string, k = key) => request.get(`/api/v1/${path}`, { headers: k ? { authorization: `Bearer ${k}` } : {} });
    // Page through every person.
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await get(`people?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      expect(res.status(), await res.text()).toBe(200);
      const body = (await res.json()) as { data: { id: string }[]; next_cursor: string | null };
      ids.push(...body.data.map((p) => p.id));
      cursor = body.next_cursor;
    } while (cursor);
    const [ridgeline] = await sql<{ n: number }[]>`select count(*)::int as n from people where tenant_id = ${R} and archived_at is null`;
    expect(ids.length).toBe(ridgeline?.n);
    expect(new Set(ids).size).toBe(ids.length);
    const filtered = (await (await get("people?type=student&status=active&limit=5")).json()) as { data: { status: string; type_flags: string[] }[] };
    expect(filtered.data.every((p) => p.status === "active" && p.type_flags.includes("student"))).toBe(true);

    // Another school's key: its own rows only, none of Ridgeline's.
    const harborKey = `kg_live_${"H".repeat(8)}_${randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").padEnd(32, "x").slice(0, 32)}`;
    await sql`insert into api_keys (tenant_id, name, key_hash, prefix, scopes) values (${H}, 'Harbor spec', ${createHash("sha256").update(harborKey).digest("hex")}, 'kg_live_HHHHHHHH', ${["people:read"]})`;
    const harbor = (await (await get("people?limit=200", harborKey)).json()) as { data: { id: string }[] };
    const [hn] = await sql<{ n: number }[]>`select count(*)::int as n from people where tenant_id = ${H} and archived_at is null`;
    expect(harbor.data.length).toBe(Math.min(200, hn?.n ?? 0));
    expect(harbor.data.filter((p) => ids.includes(p.id))).toEqual([]);
    expect((await get("invoices", harborKey)).status()).toBe(403); // scope

    // Errors are explicit.
    expect((await get("people", "")).status()).toBe(401);
    expect((await get("people", `kg_live_AAAAAAAA_${"A".repeat(32)}`)).status()).toBe(401);
    expect((await get("secrets")).status()).toBe(404);
    expect((await get("people?limit=5000")).status()).toBe(400);
    const spec = await request.get("/api/v1/openapi.json");
    expect(((await spec.json()) as { paths: Record<string, unknown> }).paths).toHaveProperty("/people");

    // Webhook: register a receiver, create a student, run the dispatcher.
    await page.getByLabel("Endpoint URL").fill(`http://127.0.0.1:${port}/hook`);
    await page.getByRole("button", { name: "Add endpoint" }).click();
    const secret = (await page.getByTestId("new-webhook-secret").textContent())?.trim() ?? "";
    expect(secret).toMatch(/^whsec_/);
    const [person] = await sql<{ id: string }[]>`insert into people (tenant_id, type_flags, first_name, last_name, status) values (${R}, '{student}', 'Wendy', 'Webhookson', 'active') returning id`;
    const res = await request.post(`/api/jobs/webhook_dispatch?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.ok(), await res.text()).toBe(true);
    await expect.poll(() => received.length).toBeGreaterThan(0);
    const hit = received.find((r) => r.body.includes(person?.id ?? "x"));
    expect(hit?.headers["koryograph-event"]).toBe("member.created");
    const [t, v1] = String(hit?.headers["koryograph-signature"]).split(",").map((s) => s.split("=")[1]);
    expect(v1).toBe(createHmac("sha256", secret).update(`${t}.${hit?.body}`).digest("hex"));
    expect(JSON.parse(hit?.body ?? "{}")).toMatchObject({ type: "member.created", tenant_id: R, data: { first_name: "Wendy", last_name: "Webhookson" } });
    await page.reload();
    await expect(page.getByRole("list", { name: "Recent deliveries" })).toContainText("delivered");
  });
});
