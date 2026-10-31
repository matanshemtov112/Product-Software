import { describe, expect, it } from "vitest";
import { billedQuantity, optimizeBasket, volumeScale } from "./optimize";
import type { BasketLine, SupplierInput } from "./types";

// מחירים בשקלים בבדיקות, מומרים לאגורות
const ils = (n: number) => Math.round(n * 100);

function supplier(
  id: string,
  prices: Record<string, number | number[]>,
  extra: Partial<SupplierInput> & { tierMins?: number[]; pack?: Record<string, number> } = {},
): SupplierInput {
  const tierMins = extra.tierMins ?? [0];
  const tiers = tierMins.map((min, i) => ({ id: `${id}-t${i}`, name: `מדרגה ${i}`, minMonthlyAgorot: ils(min) }));
  return {
    id,
    name: id,
    minOrderAgorot: 0,
    rating: 4.5,
    reliability: 0.95,
    delivery: { feeAgorot: 0, freeAboveAgorot: null },
    ...extra,
    tiers,
    offers: Object.entries(prices).map(([productId, p]) => {
      const perTier = Array.isArray(p) ? p : [p];
      return {
        productId,
        packSize: extra.pack?.[productId] ?? 1,
        prices: Object.fromEntries(
          perTier.map((price, i) => [tiers[i].id, { unitPriceAgorot: ils(price), kind: "REGULAR" as const }]),
        ),
      };
    }),
  };
}

const line = (productId: string, quantity: number): BasketLine => ({ productId, productName: productId, quantity });
const opts = { preference: "PRICE" as const, deliveriesPerMonth: 1 };

describe("billedQuantity", () => {
  it("rounds up to whole packs", () => {
    expect(billedQuantity({ productId: "x", packSize: 10, prices: {} }, 15)).toBe(20);
    expect(billedQuantity({ productId: "x", packSize: 10, prices: {} }, 20)).toBe(20);
    expect(billedQuantity({ productId: "x", packSize: 0.5, prices: {} }, 1.2)).toBe(1.5);
  });

  it("respects the minimum quantity", () => {
    expect(billedQuantity({ productId: "x", packSize: 1, minQuantity: 5, prices: {} }, 2)).toBe(5);
  });
});

describe("optimizeBasket", () => {
  it("returns nothing for an empty basket", () => {
    const r = optimizeBasket([], [supplier("A", { chicken: 30 })], opts);
    expect(r.recommended).toBeNull();
  });

  it("splits the basket when each supplier is cheapest in its own category", () => {
    const a = supplier("A", { chicken: 30, tomato: 8 });
    const b = supplier("B", { chicken: 35, tomato: 5 });
    const r = optimizeBasket([line("chicken", 50), line("tomato", 20)], [a, b], opts);
    expect(r.lowestCost!.totalAgorot).toBe(ils(50 * 30 + 20 * 5));
    expect(r.lowestCost!.suppliers.map((s) => s.supplierId).sort()).toEqual(["A", "B"]);
  });

  it("consolidates when a second delivery fee costs more than the saving", () => {
    const a = supplier("A", { chicken: 30, tomato: 6 }, { delivery: { feeAgorot: ils(50), freeAboveAgorot: null } });
    const b = supplier("B", { chicken: 35, tomato: 5 }, { delivery: { feeAgorot: ils(50), freeAboveAgorot: null } });
    const r = optimizeBasket([line("chicken", 50), line("tomato", 20)], [a, b], opts);
    // פיצול חוסך ₪20 על עגבניות אבל עולה ₪50 משלוח נוסף
    expect(r.lowestCost!.suppliers).toHaveLength(1);
    expect(r.lowestCost!.totalAgorot).toBe(ils(1500 + 120 + 50));
  });

  it("waives the delivery fee above the free-delivery threshold", () => {
    const a = supplier("A", { chicken: 30 }, { delivery: { feeAgorot: ils(60), freeAboveAgorot: ils(1000) } });
    const r = optimizeBasket([line("chicken", 50)], [a], opts);
    expect(r.lowestCost!.deliveryAgorot).toBe(0);
    const small = optimizeBasket([line("chicken", 10)], [a], opts);
    expect(small.lowestCost!.deliveryAgorot).toBe(ils(60));
  });

  it("charges the delivery fee per delivery in the month", () => {
    const a = supplier("A", { chicken: 30 }, { delivery: { feeAgorot: ils(40), freeAboveAgorot: null } });
    const r = optimizeBasket([line("chicken", 40)], [a], { ...opts, deliveriesPerMonth: 4 });
    expect(r.lowestCost!.deliveryAgorot).toBe(ils(160));
  });

  it("bills whole packs", () => {
    const a = supplier("A", { flour: 4 }, { pack: { flour: 25 } });
    const r = optimizeBasket([line("flour", 10)], [a], opts);
    const l = r.lowestCost!.suppliers[0].lines[0];
    expect(l.billedQuantity).toBe(25);
    expect(l.lineTotalAgorot).toBe(ils(100));
  });

  it("prices by the tier earned with that supplier's own monthly volume", () => {
    // מדרגות: עד ₪1,000 מחיר 30, מעל ₪1,000 מחיר 27
    const a = supplier("A", { chicken: [30, 27] }, { tierMins: [0, 1000] });
    const big = optimizeBasket([line("chicken", 50)], [a], opts);
    expect(big.lowestCost!.suppliers[0].tierName).toBe("מדרגה 1");
    expect(big.lowestCost!.totalAgorot).toBe(ils(50 * 27));
    const small = optimizeBasket([line("chicken", 20)], [a], opts);
    expect(small.lowestCost!.suppliers[0].tierName).toBe("מדרגה 0");
    expect(small.lowestCost!.totalAgorot).toBe(ils(20 * 30));
  });

  it("does not grant a tier when the discounted price drops spend below the threshold", () => {
    // 36 ק״ג: ₪1,080 במחיר רגיל, אבל ₪972 במחיר המדרגה, מתחת לסף ₪1,000
    const a = supplier("A", { chicken: [30, 27] }, { tierMins: [0, 1000] });
    const r = optimizeBasket([line("chicken", 36)], [a], opts);
    expect(r.lowestCost!.suppliers[0].tierName).toBe("מדרגה 0");
    expect(r.lowestCost!.totalAgorot).toBe(ils(36 * 30));
  });

  it("counts a tier on volume across all items bought from the supplier", () => {
    const a = supplier("A", { chicken: [30, 27], beef: [60, 55] }, { tierMins: [0, 2000] });
    const r = optimizeBasket([line("chicken", 30), line("beef", 25)], [a], opts);
    // 30×27 + 25×55 = 2,185 ≥ 2,000
    expect(r.lowestCost!.totalAgorot).toBe(ils(30 * 27 + 25 * 55));
  });

  it("moves items to a supplier to meet its minimum order", () => {
    const a = supplier("A", { chicken: 30, tomato: 6, oil: 10 });
    const b = supplier("B", { chicken: 31, tomato: 5 }, { minOrderAgorot: ils(500) });
    const r = optimizeBasket([line("chicken", 50), line("tomato", 20), line("oil", 10)], [a, b], opts);
    // B לבד מקבל רק עגבניות (₪100), מתחת למינימום ₪500; העברת העוף אליו עולה ₪50 בלבד
    // אבל ספק A לבד זול יותר: 1,500 + 120 + 100 = 1,720
    expect(r.lowestCost!.totalAgorot).toBe(ils(1720));
    expect(r.lowestCost!.suppliers).toHaveLength(1);
  });

  it("drops a combination that cannot reach a supplier's minimum order", () => {
    const a = supplier("A", { chicken: 30 });
    const b = supplier("B", { tomato: 5 }, { minOrderAgorot: ils(1000) });
    const r = optimizeBasket([line("chicken", 50), line("tomato", 20)], [a, b], opts);
    // B לא יכול להגיע למינימום, אז אין תוכנית שמכסה עגבניות
    expect(r.lowestCost!.missingProductIds).toEqual(["tomato"]);
    expect(r.monthlySavingsAgorot).toBeNull();
  });

  it("reports items no supplier sells", () => {
    const a = supplier("A", { chicken: 30 });
    const r = optimizeBasket([line("chicken", 10), line("saffron", 1)], [a], opts);
    expect(r.lowestCost!.missingProductIds).toEqual(["saffron"]);
  });

  it("prefers full coverage over a cheaper partial basket", () => {
    const a = supplier("A", { chicken: 25 });
    const b = supplier("B", { chicken: 35, tomato: 5 });
    const r = optimizeBasket([line("chicken", 10), line("tomato", 10)], [a, b], { ...opts, maxSuppliers: 1 });
    expect(r.lowestCost!.suppliers[0].supplierId).toBe("B");
    expect(r.lowestCost!.missingProductIds).toEqual([]);
  });

  it("skips suppliers the customer excluded for an item", () => {
    const a = supplier("A", { chicken: 25 });
    const b = supplier("B", { chicken: 30 });
    const r = optimizeBasket([{ ...line("chicken", 10), excludedSupplierIds: ["A"] }], [a, b], opts);
    expect(r.lowestCost!.suppliers[0].supplierId).toBe("B");
  });

  describe("preferences (spec section 10 example)", () => {
    // ספק A: ₪10,000, דירוג 4.1, אמינות 85%. ספק B: ₪10,250, דירוג 4.8, אמינות 96%
    const a = supplier("A", { basket: 10000 }, { rating: 4.1, reliability: 0.85 });
    const b = supplier("B", { basket: 10250 }, { rating: 4.8, reliability: 0.96 });
    const lines = [line("basket", 1)];

    it("price priority picks the cheapest", () => {
      const r = optimizeBasket(lines, [a, b], { ...opts, preference: "PRICE" });
      expect(r.recommended!.suppliers[0].supplierId).toBe("A");
    });

    it("service priority picks the better-rated supplier", () => {
      const r = optimizeBasket(lines, [a, b], { ...opts, preference: "SERVICE" });
      expect(r.recommended!.suppliers[0].supplierId).toBe("B");
      expect(r.lowestCost!.suppliers[0].supplierId).toBe("A");
      expect(r.recommended!.explanation.join(" ")).toContain("₪250");
    });

    it("uses the neutral rating for suppliers without reviews", () => {
      const fresh = supplier("C", { basket: 10000 }, { rating: null, reliability: 0.85 });
      const r = optimizeBasket(lines, [fresh], { ...opts, neutralRating: 4 });
      expect(r.recommended!.explanation.join(" ")).toContain("4.0/5");
    });
  });

  it("calculates monthly and annual savings against the current cost", () => {
    const a = supplier("A", { chicken: 30 });
    const r = optimizeBasket([line("chicken", 100)], [a], { ...opts, currentCostAgorot: ils(3300) });
    expect(r.monthlySavingsAgorot).toBe(ils(300));
    expect(r.annualSavingsAgorot).toBe(ils(3600));
  });

  it("picks the best single supplier for option B", () => {
    const a = supplier("A", { chicken: 30, tomato: 8 });
    const b = supplier("B", { chicken: 35, tomato: 5 });
    const r = optimizeBasket([line("chicken", 50), line("tomato", 20)], [a, b], opts);
    expect(r.singleSupplier!.suppliers).toHaveLength(1);
    expect(r.singleSupplier!.suppliers[0].supplierId).toBe("A");
  });
});

describe("declared monthly volume", () => {
  // מדרגה שנייה מ-₪10,000 בחודש, זולה ב-10%
  const big = supplier("big", { chicken: [30, 27] }, { tierMins: [0, 10000] });
  const lines = [line("chicken", 100)]; // ₪3,000 בסל

  it("prices a small customer at the base tier", () => {
    const plan = optimizeBasket(lines, [big], opts).lowestCost!;
    expect(plan.suppliers[0].tierName).toBe("מדרגה 0");
    expect(plan.totalAgorot).toBe(ils(3000));
  });

  it("gives a customer who buys more each month the tier that volume reaches", () => {
    const scale = volumeScale(lines, [big], ils(100000));
    expect(scale).toBeCloseTo(100000 / 3000);
    const plan = optimizeBasket(lines, [big], { ...opts, volumeScale: scale }).lowestCost!;
    expect(plan.suppliers[0].tierName).toBe("מדרגה 1");
    expect(plan.totalAgorot).toBe(ils(2700));
  });

  it("never shrinks the volume below the basket itself", () => {
    expect(volumeScale(lines, [big], ils(1000))).toBe(1);
    expect(volumeScale(lines, [big], null)).toBe(1);
  });

  it("credits each supplier only with its share of the declared volume", () => {
    const a = supplier("a", { chicken: [30, 27] }, { tierMins: [0, 10000] });
    const b = supplier("b", { tomato: [5, 4] }, { tierMins: [0, 10000] });
    const mixed = [line("chicken", 100), line("tomato", 100)]; // ₪3,000 + ₪500
    // היקף של ₪14,000: הספק של העוף מקבל 6/7 (₪12,000) ועולה מדרגה; ספק העגבניות מקבל ₪2,000 ולא
    const scale = volumeScale(mixed, [a, b], ils(14000));
    const plan = optimizeBasket(mixed, [a, b], { ...opts, volumeScale: scale }).lowestCost!;
    const tierOf = (id: string) => plan.suppliers.find((s) => s.supplierId === id)!.tierName;
    expect(tierOf("a")).toBe("מדרגה 1");
    expect(tierOf("b")).toBe("מדרגה 0");
  });
});
