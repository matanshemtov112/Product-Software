import { describe, expect, it } from "vitest";
import {
  buildMonthlyReport,
  lastFullMonth,
  priceAt,
  reportMonth,
  reportMonths,
  type PricePoint,
} from "./monthly-report";

const d = (s: string) => new Date(s);
const point = (
  supplierId: string,
  unitPriceAgorot: number,
  from: string,
  extra: Partial<PricePoint> = {},
): PricePoint => ({
  supplierId,
  productId: "chicken",
  unitPriceAgorot,
  kind: "REGULAR",
  validFrom: d(from),
  validTo: null,
  ...extra,
});

describe("months", () => {
  const now = d("2026-11-15T12:00:00");
  it("lists months from sign-up to now, newest first", () => {
    const months = reportMonths(d("2026-09-20T00:00:00"), now);
    expect(months.map((m) => m.key)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(months[0].partial).toBe(true);
    expect(months[1].label).toBe("אוקטובר 2026");
    expect(months[1].end).toEqual(new Date(2026, 10, 1));
  });
  it("crosses the year", () => {
    expect(reportMonths(d("2025-12-05T00:00:00"), d("2026-01-02T00:00:00")).map((m) => m.key)).toEqual([
      "2026-01",
      "2025-12",
    ]);
  });
  it("rejects bad and future keys", () => {
    expect(reportMonth("2026-13", now)).toBeNull();
    expect(reportMonth("2026-12", now)).toBeNull();
    expect(reportMonth("nope", now)).toBeNull();
  });
  it("last full month is null for a customer who joined this month", () => {
    expect(lastFullMonth(d("2026-11-02T00:00:00"), now)).toBeNull();
    expect(lastFullMonth(d("2026-10-02T00:00:00"), now)?.key).toBe("2026-10");
  });
});

describe("priceAt", () => {
  const points = [point("a", 3000, "2026-09-01"), point("a", 3200, "2026-10-10")];
  it("takes the latest regular price already in effect", () => {
    expect(priceAt(points, d("2026-10-01"))).toBe(3000);
    expect(priceAt(points, d("2026-10-20"))).toBe(3200);
    expect(priceAt(points, d("2026-08-01"))).toBeNull();
  });
  it("uses a cheaper promotion while it is valid", () => {
    const promo = point("a", 2800, "2026-10-12", { kind: "PROMOTION", validTo: d("2026-10-19") });
    expect(priceAt([...points, promo], d("2026-10-15"))).toBe(2800);
    expect(priceAt([...points, promo], d("2026-10-20"))).toBe(3200);
  });
});

describe("buildMonthlyReport", () => {
  const month = reportMonth("2026-10", d("2026-11-15"))!;
  const base = {
    month,
    supplierNames: { cur: "הספק שלי", other: "ספק זול" },
    checks: 2,
    alerts: 3,
  };
  const product = {
    productId: "chicken",
    productName: "חזה עוף",
    unitLabel: "ק״ג",
    monthlyQuantity: 50,
    paidAgorot: 3400,
    currentSupplierId: "cur",
  };

  it("reports a price increase at the current supplier and a cheaper offer", () => {
    const report = buildMonthlyReport({
      ...base,
      products: [product],
      prices: [
        point("cur", 3400, "2026-09-01"),
        point("cur", 3600, "2026-10-15"),
        point("other", 3300, "2026-09-01"),
        point("other", 3100, "2026-10-20"),
      ],
      accepted: [],
    });
    expect(report.productsChecked).toBe(1);
    expect(report.suppliersCompared).toBe(2);
    expect(report.increases).toEqual([
      expect.objectContaining({ beforeAgorot: 3400, afterAgorot: 3600, monthlyImpactAgorot: 10000 }),
    ]);
    expect(report.decreases).toEqual([]);
    expect(report.marketMoves).toEqual([
      expect.objectContaining({ supplierName: "ספק זול", beforeAgorot: 3300, afterAgorot: 3100 }),
    ]);
    expect(report.opportunities).toEqual([
      expect.objectContaining({ supplierName: "ספק זול", bestAgorot: 3100, monthlySavingAgorot: 15000 }),
    ]);
    expect(report.potentialSavingAgorot).toBe(15000);
  });

  it("ignores changes after the month and counts savings accepted in it", () => {
    const report = buildMonthlyReport({
      ...base,
      products: [{ ...product, currentSupplierId: null }],
      prices: [point("other", 3300, "2026-09-01"), point("other", 3000, "2026-11-05")],
      accepted: [
        {
          productName: "חזה עוף",
          unitLabel: "ק״ג",
          supplierName: "הספק שלי",
          monthlyQuantity: 50,
          beforeAgorot: 3600,
          afterAgorot: 3400,
          decidedAt: d("2026-10-18"),
        },
        {
          productName: "שמן",
          unitLabel: "ליטר",
          supplierName: "הספק שלי",
          monthlyQuantity: 20,
          beforeAgorot: 1000,
          afterAgorot: 900,
          decidedAt: d("2026-11-02"),
        },
      ],
    });
    expect(report.marketMoves).toEqual([]);
    expect(report.opportunities[0].bestAgorot).toBe(3300);
    expect(report.accepted).toHaveLength(1);
    expect(report.actualSavingAgorot).toBe(10000);
  });

  it("does not suggest the current supplier as a cheaper option", () => {
    const report = buildMonthlyReport({
      ...base,
      products: [{ ...product, paidAgorot: 3500 }],
      prices: [point("cur", 3200, "2026-09-01"), point("other", 3300, "2026-09-01")],
      accepted: [],
    });
    expect(report.opportunities).toEqual([]);
  });
});
