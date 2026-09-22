import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const tag = randomUUID().slice(0, 6);
const docName = `Spec Waiver ${tag}`;
const programName = `Doc Program ${tag}`;
let programId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${programName}, ${`doc-${tag}`}) returning id`;
  programId = p?.id ?? "";
  await sql`insert into public.enrollments (tenant_id, person_id, program_id) values (${R}, ${MAYA}, ${programId})`;
});

test.afterAll(async () => {
  await sql`update public.document_templates set active = false where tenant_id = ${R} and name = ${docName}`;
  await sql`delete from public.programs where id = ${programId}`;
});

test.describe("@m1 documents & waivers", () => {
  test("publish → parent signs on Home (PDF stored) → v2 prompts again → signing link completes it", async ({ browser }) => {
    const owner = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await owner.goto("/desk/documents/new");
    await owner.getByLabel("Document name", { exact: true }).fill(docName);
    await owner.getByLabel("Every active student").uncheck();
    await owner.getByLabel(`Students in ${programName}`).check();
    await owner.getByRole("button", { name: "Publish" }).click();
    await expect(owner.getByRole("heading", { level: 1, name: docName })).toBeVisible();

    await owner.goto("/desk/compliance");
    const unsigned = owner.getByRole("list", { name: "Unsigned required documents" });
    await expect(unsigned.getByRole("listitem", { name: `Maya Cooper: ${docName}` })).toBeVisible();
    const before = await unsigned.getByRole("listitem").count();

    // Parent signs from Home.
    const parentCtx = await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    const parent = await parentCtx.newPage();
    await parent.goto("/home/documents");
    const todo = parent.getByRole("list", { name: "Documents to sign" }).getByRole("listitem", { name: `${docName} for Maya Cooper` });
    await todo.getByRole("link", { name: "Review & sign" }).click();
    await expect(parent.getByRole("article", { name: "Document" })).toContainText("Maya Cooper");
    await parent.getByLabel(/I have read/).check();
    await parent.getByLabel("Type your full name to sign").fill("Morgan Cooper");
    await parent.getByRole("button", { name: "Sign" }).click();
    await expect(parent).toHaveURL(/\/home\/documents$/);
    await expect(parent.getByRole("list", { name: "Signed documents" })).toContainText(docName);

    const [sig] = await sql<{ pdf_path: string | null; method: string; ip: string | null }[]>`
      select s.pdf_path, s.method, s.ip from public.signatures s join public.document_templates t on t.id = s.template_id
      where t.name = ${docName} and t.version = 1 and s.person_id = ${MAYA}`;
    expect(sig?.method).toBe("home");
    expect(sig?.pdf_path).toMatch(new RegExp(`^${R}/households/.+/signatures/.+\\.pdf$`));
    const [obj] = await sql<{ n: number }[]>`select count(*)::int as n from storage.objects where bucket_id = 'tenant-media' and name = ${sig?.pdf_path ?? ""}`;
    expect(obj?.n).toBe(1);

    await owner.reload();
    await expect(unsigned.getByRole("listitem", { name: `Maya Cooper: ${docName}` })).toHaveCount(0);
    expect(await unsigned.getByRole("listitem").count()).toBe(before - 1);

    // Version 2 → the family is prompted again.
    await owner.goto("/desk/documents");
    await owner.getByRole("link", { name: `${docName} version 1` }).click();
    await owner.getByLabel("Text", { exact: true }).fill(`# ${docName}\n\nUpdated terms for {{student_name}} at {{school_name}}. Please read carefully before signing.`);
    await owner.getByRole("button", { name: "Publish version 2" }).click();
    await expect(owner.getByRole("link", { name: "v2", exact: true })).toBeVisible();
    await parent.goto("/home/documents");
    await expect(parent.getByRole("listitem", { name: `${docName} for Maya Cooper` })).toContainText("updated — please sign the new version");

    // Staff emails a signing link; the family signs without logging in.
    await owner.goto("/desk/compliance");
    await owner.getByRole("button", { name: `Email signing link: Maya Cooper, ${docName}` }).click();
    await expect(owner.getByText(/Signing link: .*unsent no provider/)).toBeVisible();
    const [c] = await sql<{ body_text: string }[]>`select body_text from public.communications where template_key = 'signature_request' and to_address = 'parent@ridgelinetkd.demo' order by created_at desc limit 1`;
    const link = /http:\/\/localhost:3100\/sign\/[A-Za-z0-9_-]+/.exec(c?.body_text ?? "")?.[0];
    expect(link).toBeTruthy();

    const anon = await (await browser.newContext()).newPage();
    await anon.goto(link ?? "");
    await expect(anon.getByRole("article", { name: "Document" })).toContainText("Updated terms for Maya Cooper");
    await anon.getByLabel(/I have read/).check();
    await anon.getByLabel("Type your full name to sign").fill("Morgan Cooper");
    await anon.getByRole("button", { name: "Sign" }).click();
    await expect(anon.getByRole("status")).toContainText("Signed — thank you");
    await anon.goto(link ?? "");
    await expect(anon.getByRole("heading", { name: "Already signed" })).toBeVisible();

    const res = await owner.request.post(`/api/jobs/signature_pdfs?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    const [sig2] = await sql<{ pdf_path: string | null; method: string }[]>`
      select s.pdf_path, s.method from public.signatures s join public.document_templates t on t.id = s.template_id where t.name = ${docName} and t.version = 2 and s.person_id = ${MAYA}`;
    expect(sig2?.method).toBe("link");
    expect(sig2?.pdf_path).toBeTruthy();
    await parentCtx.close();
  });
});
