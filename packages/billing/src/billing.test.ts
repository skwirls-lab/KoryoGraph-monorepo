import { describe, expect, it } from "vitest";
import {
  DEFAULT_DUNNING, addDaysStr, addMonthsStr, advancePeriod, allocatePayment, applyCoupons, computeInvoice, daysBetween, deferredRevenue,
  dueDunningSteps, familyDiscountPct, familyDiscounts, firstBillingDate, firstInvoiceLines, freezeProration, prorate, recognitionSchedule, upgradeProration,
} from "./index";

describe("dates", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2024-01-31", 1, "2024-02-29"],
    ["2026-12-15", 1, "2027-01-15"],
    ["2026-03-31", -1, "2026-02-28"],
    ["2026-05-10", 12, "2027-05-10"],
  ])("addMonths(%s, %i) = %s", (d, n, want) => expect(addMonthsStr(d, n)).toBe(want));
  it("adds days and measures gaps", () => {
    expect(addDaysStr("2026-02-27", 2)).toBe("2026-03-01");
    expect(daysBetween("2026-09-01", "2026-10-01")).toBe(30);
  });
});

describe("periods", () => {
  it.each([
    ["2026-09-01", "week", 1, "2026-09-08"],
    ["2026-09-01", "week", 2, "2026-09-15"],
    ["2026-09-01", "month", 1, "2026-10-01"],
    ["2026-09-01", "month", 3, "2026-12-01"],
    ["2026-09-01", "year", 1, "2027-09-01"],
  ] as const)("advance(%s, %s×%i) = %s", (s, i, c, want) => expect(advancePeriod(s, i, c)).toBe(want));
  it("rejects a zero interval count", () => expect(() => advancePeriod("2026-09-01", "month", 0)).toThrow());
  it.each([
    ["2026-09-01", 1, "2026-09-01"],
    ["2026-09-02", 1, "2026-10-01"],
    ["2026-09-10", 15, "2026-09-15"],
    ["2026-09-16", 15, "2026-10-15"],
  ])("firstBillingDate(%s, day %i) = %s", (from, day, want) => expect(firstBillingDate(from, day)).toBe(want));
  it("rejects billing days outside 1–28", () => {
    expect(() => firstBillingDate("2026-09-01", 0)).toThrow();
    expect(() => firstBillingDate("2026-09-01", 29)).toThrow();
  });
});

describe("proration", () => {
  it.each([
    ["full period when starting on the period start", 15_000, "2026-09-01", "2026-10-01", "2026-09-01", 15_000],
    ["before start = full", 15_000, "2026-09-01", "2026-10-01", "2026-08-20", 15_000],
    ["half a 30-day month", 15_000, "2026-09-01", "2026-10-01", "2026-09-16", 7_500],
    ["21 of 30 days", 14_900, "2026-09-01", "2026-10-01", "2026-09-10", 10_430],
    ["after end = nothing", 15_000, "2026-09-01", "2026-10-01", "2026-10-01", 0],
    ["one day of February (28)", 2_800, "2026-02-01", "2026-03-01", "2026-02-28", 100],
  ])("%s", (_n, price, s, e, from, want) => expect(prorate(price, s, e, from)).toBe(want));
  it("rejects empty periods", () => expect(() => prorate(100, "2026-09-01", "2026-09-01", "2026-09-01")).toThrow());

  it("upgrade mid-cycle charges the difference for the remaining days", () => {
    expect(upgradeProration(12_000, 18_000, "2026-09-01", "2026-10-01", "2026-09-16")).toEqual({ credit: 6_000, charge: 9_000, net: 3_000 });
  });
  it("downgrade mid-cycle nets a credit", () => {
    expect(upgradeProration(18_000, 12_000, "2026-09-01", "2026-10-01", "2026-09-16").net).toBe(-3_000);
  });

  it.each([
    ["no overlap charges full price", "2026-10-05", "2026-10-20", 0, 15_000],
    ["10 held days of 30", "2026-09-11", "2026-09-21", 0, 10_000],
    ["hold covering the whole period + fee", "2026-08-01", "2026-11-01", 1_500, 1_500],
    ["hold starting before the period", "2026-08-20", "2026-09-11", 0, 10_000],
    ["hold with a fee", "2026-09-11", "2026-09-21", 1_000, 11_000],
  ])("freeze: %s", (_n, from, until, fee, want) => expect(freezeProration(15_000, "2026-09-01", "2026-10-01", from, until, fee)).toBe(want));
  it("freeze rejects empty periods", () => expect(() => freezeProration(1, "2026-09-01", "2026-09-01", "2026-09-01", "2026-09-02")).toThrow());
});

describe("family discounts", () => {
  const rule = { secondPct: 10, thirdPlusPct: 100 };
  it.each([
    ["one child: no discount", [{ id: "a", priceCents: 14_900 }], { a: 0 }],
    ["two children: 10% off the cheaper", [{ id: "a", priceCents: 14_900 }, { id: "b", priceCents: 12_900 }], { a: 0, b: 1_290 }],
    ["third child free", [{ id: "a", priceCents: 14_900 }, { id: "b", priceCents: 14_900 }, { id: "c", priceCents: 12_900 }], { a: 0, b: 1_490, c: 12_900 }],
    ["ties broken by id", [{ id: "b", priceCents: 100 }, { id: "a", priceCents: 100 }], { a: 0, b: 10 }],
  ])("%s", (_n, items, want) => expect(familyDiscounts(items, rule)).toEqual(want));
  it("clamps percentages to 0–100", () => {
    expect(familyDiscounts([{ id: "a", priceCents: 1_000 }, { id: "b", priceCents: 1_000 }, { id: "c", priceCents: 1_000 }], { secondPct: -5, thirdPlusPct: 150 })).toEqual({ a: 0, b: 0, c: 1_000 });
  });
  it("gives one item's percentage by the same ranking", () => {
    const items = [{ id: "a", priceCents: 14_900 }, { id: "b", priceCents: 14_900 }, { id: "zzz-new", priceCents: 14_900 }];
    expect(familyDiscountPct(items, "a", rule)).toBe(0);
    expect(familyDiscountPct(items, "b", rule)).toBe(10);
    expect(familyDiscountPct(items, "zzz-new", rule)).toBe(100);
    expect(familyDiscountPct(items, "missing", rule)).toBe(0);
    expect(familyDiscountPct(items.slice(0, 2), "b", { secondPct: 150, thirdPlusPct: 0 })).toBe(100);
  });
});

describe("coupons", () => {
  it.each([
    ["percentage", 10_000, [{ kind: "pct", value: 20 }], 2_000],
    ["amount", 10_000, [{ kind: "amount", value: 2_500 }], 2_500],
    ["amount never below zero", 1_000, [{ kind: "amount", value: 2_500 }], 1_000],
    ["capped percentage", 100_000, [{ kind: "pct", value: 50, maxCents: 10_000 }], 10_000],
    ["stacking applies sequentially", 10_000, [{ kind: "amount", value: 2_000 }, { kind: "pct", value: 50 }], 6_000],
    ["percent over 100 is clamped", 5_000, [{ kind: "pct", value: 150 }], 5_000],
    ["no coupons", 5_000, [], 0],
  ] as const)("%s", (_n, amount, coupons, want) => expect(applyCoupons(amount, coupons)).toBe(want));
});

describe("computeInvoice", () => {
  it("sums lines, applies line + coupon discounts to discountable lines only, taxes per line", () => {
    const r = computeInvoice(
      [
        { kind: "membership", description: "Youth unlimited", unitCents: 14_900, lineDiscountCents: 1_490 },
        { kind: "fee", description: "Enrollment", unitCents: 4_900, discountable: false },
        { kind: "product", description: "Uniform", unitCents: 4_500, quantity: 2, taxClass: "retail" },
      ],
      [{ kind: "amount", value: 1_000 }],
      { retail: 0.06 },
    );
    expect(r.subtotalCents).toBe(14_900 + 4_900 + 9_000);
    expect(r.lines[0]?.discountCents).toBe(1_490 + 1_000);
    expect(r.lines[1]?.discountCents).toBe(0);
    expect(r.lines[2]).toMatchObject({ grossCents: 9_000, discountCents: 0, taxCents: 540, totalCents: 9_540 });
    expect(r.taxCents).toBe(540);
    expect(r.totalCents).toBe(28_800 - 2_490 + 540);
  });
  it("spreads a coupon across several discountable lines, last line takes rounding", () => {
    const r = computeInvoice([
      { kind: "membership", description: "A", unitCents: 10_000 },
      { kind: "membership", description: "B", unitCents: 5_001 },
    ], [{ kind: "pct", value: 10 }]);
    expect(r.discountCents).toBe(1_500);
    expect(r.lines.map((l) => l.discountCents)).toEqual([1_000, 500]);
  });
  it("handles negative adjustments and unknown tax classes", () => {
    const r = computeInvoice([
      { kind: "membership", description: "Plan", unitCents: 10_000, taxClass: "missing" },
      { kind: "adjustment", description: "Goodwill", unitCents: -2_000, taxClass: "exempt" },
    ]);
    expect(r).toMatchObject({ subtotalCents: 8_000, discountCents: 0, taxCents: 0, totalCents: 8_000 });
  });
  it("caps a line discount at the line amount and ignores coupons with nothing discountable", () => {
    const r = computeInvoice([{ kind: "fee", description: "Fee", unitCents: 1_000, lineDiscountCents: 5_000, discountable: false }], [{ kind: "pct", value: 50 }]);
    expect(r.totalCents).toBe(0);
    expect(computeInvoice([], [{ kind: "pct", value: 50 }]).totalCents).toBe(0);
  });
  it("a coupon has nothing to take when every discountable line is already fully discounted", () => {
    const r = computeInvoice([
      { kind: "membership", description: "A", unitCents: 1_000, lineDiscountCents: 1_000 },
      { kind: "membership", description: "B", unitCents: 2_000, lineDiscountCents: 2_000 },
    ], [{ kind: "amount", value: 500 }]);
    expect(r.lines.map((l) => l.discountCents)).toEqual([1_000, 2_000]);
    expect(r.totalCents).toBe(0);
  });
  it("does not tax a fully discounted line", () => {
    const r = computeInvoice([{ kind: "product", description: "Belt", unitCents: 1_000, taxClass: "retail", discountable: true, lineDiscountCents: 1_000 }], [], { retail: 0.07 });
    expect(r.taxCents).toBe(0);
  });
});

describe("paid-in-full recognition", () => {
  it("spreads evenly with the remainder in the last month", () => {
    const s = recognitionSchedule(100_000, "2026-01-15", 12);
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ month: "2026-01-15", cents: 8_333 });
    expect(s[11]).toEqual({ month: "2026-12-15", cents: 8_337 });
    expect(s.reduce((t, x) => t + x.cents, 0)).toBe(100_000);
  });
  it("reports deferred revenue as of a date", () => {
    expect(deferredRevenue(120_000, "2026-01-01", 12, "2026-03-15")).toBe(90_000);
    expect(deferredRevenue(120_000, "2026-01-01", 12, "2027-01-01")).toBe(0);
  });
  it("rejects zero months", () => expect(() => recognitionSchedule(1, "2026-01-01", 0)).toThrow());
});

describe("dunning schedule", () => {
  it.each([
    ["day 0: nothing yet", "2026-09-01", 0, []],
    ["day 1: first step", "2026-09-02", 0, [0]],
    ["day 3 with step 1 done", "2026-09-04", 1, [1]],
    ["day 7 with nothing done catches up", "2026-09-08", 0, [0, 1, 2]],
    ["all steps done", "2026-09-20", 3, []],
  ] as const)("%s", (_n, today, done, want) => expect(dueDunningSteps(DEFAULT_DUNNING, "2026-09-01", today, done)).toEqual(want));
  it("the last default step suspends", () => expect(DEFAULT_DUNNING.at(-1)?.actions).toContain("suspend"));
});

describe("allocatePayment (FIFO, oldest first)", () => {
  const invs = [
    { id: "b", balanceCents: 5_000, dueAt: "2026-08-01" },
    { id: "a", balanceCents: 3_000, dueAt: "2026-07-01" },
    { id: "c", balanceCents: 2_000, dueAt: "2026-08-01" },
    { id: "z", balanceCents: 0, dueAt: "2026-06-01" },
  ];
  it.each([
    ["covers the oldest first", 4_000, [{ invoiceId: "a", cents: 3_000 }, { invoiceId: "b", cents: 1_000 }], 0],
    ["exact total", 10_000, [{ invoiceId: "a", cents: 3_000 }, { invoiceId: "b", cents: 5_000 }, { invoiceId: "c", cents: 2_000 }], 0],
    ["overpayment becomes credit", 12_500, [{ invoiceId: "a", cents: 3_000 }, { invoiceId: "b", cents: 5_000 }, { invoiceId: "c", cents: 2_000 }], 2_500],
    ["zero", 0, [], 0],
  ])("%s", (_n, amount, allocations, leftover) => expect(allocatePayment(amount, invs)).toEqual({ allocations, leftoverCents: leftover }));
  it("rejects negative amounts", () => expect(() => allocatePayment(-1, invs)).toThrow());
});

describe("first invoice for a new membership", () => {
  const monthly = { kind: "recurring" as const, priceCents: 15_000, interval: "month" as const, intervalCount: 1, enrollmentFeeCents: 4_900 };
  it("prorates a monthly plan started mid-month and adds the enrollment fee", () => {
    const r = firstInvoiceLines(monthly, "Youth unlimited", "2026-09-16", 1);
    expect(r.nextBillAt).toBe("2026-10-01");
    expect(r.lines).toEqual([
      { kind: "membership", description: "Youth unlimited (prorated from 2026-09-16)", unitCents: 7_500 },
      { kind: "fee", description: "Enrollment fee", unitCents: 4_900, discountable: false },
    ]);
  });
  it("charges a full month when starting on the billing day", () => {
    const r = firstInvoiceLines({ ...monthly, enrollmentFeeCents: 0 }, "Plan", "2026-10-01", 1);
    expect(r.lines).toEqual([{ kind: "membership", description: "Plan", unitCents: 15_000 }]);
    expect(r.nextBillAt).toBe("2026-11-01");
  });
  it("weekly and yearly plans bill a full period from the start", () => {
    expect(firstInvoiceLines({ ...monthly, interval: "week", enrollmentFeeCents: 0 }, "Weekly", "2026-09-16", 1).nextBillAt).toBe("2026-09-23");
    expect(firstInvoiceLines({ ...monthly, interval: "year", enrollmentFeeCents: 0 }, "Annual", "2026-09-16", 1).nextBillAt).toBe("2027-09-16");
  });
  it("one-off kinds charge the price once; free trials add nothing", () => {
    expect(firstInvoiceLines({ kind: "paid_in_full", priceCents: 150_000, interval: null, intervalCount: 1, enrollmentFeeCents: 0 }, "Annual PIF", "2026-09-16", 1))
      .toMatchObject({ lines: [{ kind: "membership", unitCents: 150_000 }], nextBillAt: null, periodEnd: null });
    expect(firstInvoiceLines({ kind: "trial", priceCents: 0, interval: null, intervalCount: 1, enrollmentFeeCents: 0 }, "Free trial", "2026-09-16", 1).lines).toEqual([]);
    expect(firstInvoiceLines({ kind: "trial", priceCents: 2_900, interval: null, intervalCount: 1, enrollmentFeeCents: 0 }, "2-week trial", "2026-09-16", 1).lines).toHaveLength(1);
  });
});
