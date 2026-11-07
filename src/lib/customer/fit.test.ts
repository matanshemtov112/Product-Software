import { describe, expect, it } from "vitest";
import { rankSuppliers, type FitInput } from "./fit";

const row = (id: string, covered: number, total: number, best: number, extra: Partial<FitInput["supplier"]> = {}): FitInput => ({
  supplierId: id,
  supplierName: id,
  supplier: {
    id,
    name: id,
    minOrderAgorot: 0,
    rating: null,
    reliability: 0.9,
    delivery: { feeAgorot: 0, freeAboveAgorot: null },
    tiers: [],
    offers: [],
    ...extra,
  },
  covered,
  categories: ["ירקות"],
  totalAgorot: total,
  deliveryAgorot: 0,
  bestAlternativeAgorot: best,
  gapAgorot: total - best,
  tierName: "רגיל",
});

describe("rankSuppliers", () => {
  it("prefers a supplier that covers more of the basket when prices are close", () => {
    const ranked = rankSuppliers([row("partial", 3, 1000, 1000), row("full", 10, 6100, 5900)], 10, "BALANCED");
    expect(ranked.map((r) => r.supplierId)).toEqual(["full", "partial"]);
    expect(ranked[0].labels).toContain("הכי מתאים לסל");
    expect(ranked[0].labels).toContain("ספק אחד לכל הסל");
    expect(ranked[1].labels).toContain("הכי זול לחלק שלו");
  });

  it("lets price decide between suppliers with the same coverage under 'price first'", () => {
    const ranked = rankSuppliers(
      [row("pricey", 10, 7000, 6000, { rating: 5, reliability: 1 }), row("cheap", 10, 6000, 6000, { rating: 3 })],
      10,
      "PRICE",
    );
    expect(ranked[0].supplierId).toBe("cheap");
  });

  it("lets rating and reliability count under 'service first'", () => {
    const ranked = rankSuppliers(
      [row("cheap", 10, 6000, 6000, { rating: 2.5, reliability: 0.7 }), row("good", 10, 6200, 6000, { rating: 4.9, reliability: 0.98 })],
      10,
      "SERVICE",
    );
    expect(ranked[0].supplierId).toBe("good");
  });

  it("explains coverage, price gap, rating and delivery", () => {
    const [r] = rankSuppliers([row("a", 3, 1100, 1000)], 10, "BALANCED");
    expect(r.reasons[0]).toBe("מכסה 3 מתוך 10 מוצרים: ירקות");
    expect(r.reasons[1]).toContain("10.0%");
    expect(r.reasons).toContain("עוד אין מספיק דירוגים");
    expect(r.reasons).toContain("משלוח חינם");
  });
});
