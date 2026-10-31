import { describe, expect, it } from "vitest";
import { quoteForSupplier } from "./quote";
import type { BasketLine, SupplierInput } from "./types";

const ils = (n: number) => Math.round(n * 100);

function supplier(id: string, prices: Record<string, number>, extra: Partial<SupplierInput> = {}): SupplierInput {
  const tier = { id: `${id}-t0`, name: "רגיל", minMonthlyAgorot: 0 };
  return {
    id,
    name: id,
    minOrderAgorot: 0,
    rating: null,
    reliability: 0.9,
    delivery: { feeAgorot: 0, freeAboveAgorot: null },
    ...extra,
    tiers: [tier],
    offers: Object.entries(prices).map(([productId, p]) => ({
      productId,
      packSize: 1,
      prices: { [tier.id]: { unitPriceAgorot: ils(p), kind: "REGULAR" as const } },
    })),
  };
}

const line = (productId: string, quantity: number): BasketLine => ({ productId, productName: productId, quantity });
const opts = { preference: "BALANCED" as const, deliveriesPerMonth: 1 };

describe("quoteForSupplier", () => {
  const lines = [line("chicken", 10), line("tomato", 20), line("cheese", 5)];
  const meat = supplier("meat", { chicken: 32 });
  const general = supplier("general", { chicken: 30, tomato: 6, cheese: 40 });
  const veg = supplier("veg", { tomato: 5 });

  it("quotes only the items the supplier sells, against the cheapest mix for those items", () => {
    const q = quoteForSupplier(lines, [meat, general, veg], opts, "meat")!;
    expect(q.share.lines.map((l) => l.productId)).toEqual(["chicken"]);
    expect(q.missingProductIds.sort()).toEqual(["cheese", "tomato"]);
    expect(q.share.totalAgorot).toBe(ils(320));
    expect(q.bestAlternativeAgorot).toBe(ils(300));
    expect(q.gapAgorot).toBe(ils(20));
  });

  it("can compare against a combination of several suppliers", () => {
    const q = quoteForSupplier(lines, [meat, general, veg], opts, "general")!;
    expect(q.share.totalAgorot).toBe(ils(300 + 120 + 200));
    // עגבניות זולות יותר אצל ספק הירקות
    expect(q.gapAgorot).toBe(ils(20));
  });

  it("has no gap when the supplier is already the cheapest", () => {
    const q = quoteForSupplier(lines, [meat, general, veg], opts, "veg")!;
    expect(q.gapAgorot).toBe(0);
  });

  it("includes delivery fees in the gap", () => {
    const pricey = supplier("pricey", { chicken: 30 }, { delivery: { feeAgorot: ils(50), freeAboveAgorot: null } });
    const q = quoteForSupplier([line("chicken", 10)], [pricey, meat], opts, "pricey")!;
    expect(q.share.totalAgorot).toBe(ils(350));
    expect(q.gapAgorot).toBe(ils(30));
  });

  it("returns null for a supplier below its minimum order or not in the list", () => {
    const big = supplier("big", { chicken: 30 }, { minOrderAgorot: ils(1000) });
    expect(quoteForSupplier([line("chicken", 10)], [big, meat], opts, "big")).toBeNull();
    expect(quoteForSupplier(lines, [meat], opts, "nobody")).toBeNull();
  });
});
