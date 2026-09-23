import path from "node:path";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const started = new Date();
const SKUS = { "DOBOK-2": 10, "DOBOK-3": 8, "SPARRING-SET-M": 4, "MOUTHGUARD-YOUTH": 20, "WHITE-BELT-2": 12, "FOCUS-MITTS": 6 } as const;
const onHand = async () => Object.fromEntries((await sql<{ sku: string; n: number }[]>`
  select v.sku, coalesce(sum(l.on_hand), 0)::int as n from product_variants v left join inventory_levels l on l.variant_id = v.id
  where v.tenant_id = ${R} and v.sku = any(${Object.keys(SKUS)}) group by v.sku`).map((r) => [r.sku, r.n]));

test.afterAll(async () => {
  const items = await sql<{ id: string; po: string | null }[]>`select id, entity_id as po from approval_items where tenant_id = ${R} and kind = 'doc_intake' and created_at >= ${started}`;
  for (const i of items) {
    if (i.po) {
      await sql`delete from inventory_movements where ref_type = 'purchase_order' and ref_id = ${i.po}`;
      await sql`delete from purchase_orders where id = ${i.po}`;
    }
  }
  await sql`delete from approval_items where tenant_id = ${R} and kind = 'doc_intake' and created_at >= ${started}`;
  // Re-derive stock from the movement ledger after removing the test's movements.
  await sql`update inventory_levels l set on_hand = coalesce((select sum(m.delta) from inventory_movements m where m.variant_id = l.variant_id and m.location_id = l.location_id), 0) where l.tenant_id = ${R}`;
});

test.describe("@m4 document intake", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("upload a packing slip → lines read and matched (fuzzy 'Focus mitts pair'; unknown board unmatched) → receive → stock up by the extracted quantities", async ({ page }) => {
    test.setTimeout(90_000);
    const before = await onHand();
    await page.goto("/desk/retail/receive");
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tests/fixtures/docs/century-packing-slip.png"));
    const draft = page.getByRole("region", { name: /Receive stock from Dojo Supply Co\. · DS-48812/ });
    await expect(draft).toBeVisible({ timeout: 30_000 });
    await expect(draft.getByLabel(/^Supplier/)).toHaveValue(sid("supplier:ridgeline:century"));
    await expect(draft.getByRole("checkbox", { name: "Receive Focus mitts pair" })).toBeChecked();
    await expect(draft.getByRole("checkbox", { name: "Receive Rebreakable board, black (hard)" })).toBeDisabled();
    await expect(draft.getByRole("row", { name: "Rebreakable board, black (hard)" })).toContainText("no match");
    await expectNoSeriousA11yViolations(page);
    await draft.getByRole("button", { name: "Receive 60 units" }).click();
    await expect(page.getByRole("list", { name: "Recently received" })).toContainText("60 units received on 6 lines");

    const after = await onHand();
    for (const [sku, qty] of Object.entries(SKUS)) expect(after[sku], sku).toBe((before[sku] ?? 0) + qty);
    const [po] = await sql`select po.status, (select count(*)::int from purchase_order_lines l where l.po_id = po.id) as lines from purchase_orders po
      join approval_items a on a.entity_id = po.id where a.tenant_id = ${R} and a.kind = 'doc_intake' and a.created_at >= ${started}`;
    expect(po).toEqual({ status: "received", lines: 6 });
  });
});
