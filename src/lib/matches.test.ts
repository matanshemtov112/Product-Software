import { describe, expect, it } from "vitest";
import { matchCandidates, matchRequestText, matchSummary, offeredPrice } from "./matches";
import type { PaidComparisonLine } from "./customer/paid-prices";

const offer = (supplierId: string, price: number) => ({
  supplierId,
  supplierName: supplierId,
  productId: "p",
  unitPriceAgorot: price,
});

describe("matchCandidates", () => {
  it("keeps only products with a cheaper price in the system, biggest saving first", () => {
    const line = (productId: string, paid: number, best: number | null, saving: number): PaidComparisonLine => ({
      productId,
      productName: productId,
      unit: "KG",
      quantity: 10,
      paidAgorot: paid,
      best: best === null ? null : offer("s1", best),
      offers: [],
      gapPct: null,
      monthlySavingAgorot: saving,
    });
    const c = matchCandidates([
      line("a", 1000, 900, 1000),
      line("b", 1000, 1100, 0),
      line("c", 1000, null, 0),
      line("d", 2000, 1500, 5000),
    ]);
    expect(c.map((x) => x.productId)).toEqual(["d", "a"]);
    expect(c[0]).toMatchObject({ currentPriceAgorot: 2000, targetPriceAgorot: 1500, monthlyQuantity: 10 });
  });
});

describe("matchSummary", () => {
  const base = { monthlyQuantity: 10, currentPriceAgorot: 1000, targetPriceAgorot: 800, counterPriceAgorot: null };
  it("sums requested, offered and accepted savings", () => {
    const lines = [
      { ...base, response: "MATCHED" as const, decision: "ACCEPTED" as const },
      { ...base, response: "COUNTER" as const, counterPriceAgorot: 900, decision: "PENDING" as const },
      { ...base, response: "DECLINED" as const, decision: "PENDING" as const },
    ];
    expect(offeredPrice(lines[1])).toBe(900);
    expect(offeredPrice(lines[2])).toBeNull();
    expect(matchSummary(lines)).toEqual({
      requestedAgorot: 6000,
      offeredAgorot: 3000,
      acceptedAgorot: 2000,
      matched: 1,
      countered: 1,
      declined: 1,
      awaitingDecision: 1,
    });
  });
});

describe("matchRequestText", () => {
  it("lists products and prices without naming other suppliers", () => {
    const text = matchRequestText(
      "מסעדת דמו",
      [
        {
          productId: "p",
          productName: "חזה עוף",
          unit: "KG",
          monthlyQuantity: 50,
          currentPriceAgorot: 3700,
          targetPriceAgorot: 3190,
          monthlySavingAgorot: 25500,
        },
      ],
      () => "ק״ג",
    );
    expect(text).toContain("חזה עוף");
    expect(text).toContain("₪37.00");
    expect(text).toContain("₪31.90");
    expect(text).not.toContain("s1");
  });
});
