import { describe, expect, it } from "vitest";
import type { PaidComparisonLine } from "./paid-prices";
import { scoreSupplier } from "./supplier-score";

const line = (paid: number, best: number | null, quantity = 10): PaidComparisonLine => ({
  productId: `p${paid}-${best}`,
  productName: "מוצר",
  unit: "KG",
  quantity,
  paidAgorot: paid,
  best: best === null ? null : { supplierId: "s", supplierName: "ספק", productId: "p", unitPriceAgorot: best },
  offers: [],
  gapPct: best === null ? null : Math.round(((paid - best) / best) * 1000) / 10,
  monthlySavingAgorot: best === null ? 0 : Math.max(0, (paid - best) * quantity),
});

describe("scoreSupplier", () => {
  it("rates a supplier that matches the market as competitive", () => {
    const s = scoreSupplier([line(1000, 1000), line(500, 510)]);
    expect(s).toMatchObject({ status: "competitive", score: 100, competitiveProducts: 2, cheaperElsewhere: 0 });
  });

  it("weights the gap by spend and flags an expensive supplier", () => {
    // 20% מעל על מוצר עם רוב ההוצאה, 0% על מוצר קטן
    const s = scoreSupplier([line(1200, 1000, 100), line(100, 100, 10), line(300, null)]);
    expect(s.avgGapPct).toBe(19.8);
    expect(s.status).toBe("expensive");
    expect(s.score).toBe(21);
    expect(s.cheaperElsewhere).toBe(1);
    expect(s.reasons.at(-1)).toContain("1 מוצרים לא נכנסו");
  });
});
