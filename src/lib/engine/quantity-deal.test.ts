import { describe, expect, it } from "vitest";
import { applyQuantityDeal } from "./quantity-deal";

describe("applyQuantityDeal", () => {
  const deal = { minPerOrder: 20, discountPct: 10 };
  it("gives 10% off from 20 units an order", () => {
    // 80 בחודש ב-4 אספקות = 20 בהזמנה
    expect(applyQuantityDeal(1000, deal, 80, 4)).toEqual({
      unitPriceAgorot: 900,
      applied: true,
      perOrder: 20,
      missingPerOrder: 0,
    });
  });
  it("shows how much is missing below the threshold", () => {
    expect(applyQuantityDeal(1000, deal, 64, 4)).toEqual({
      unitPriceAgorot: 1000,
      applied: false,
      perOrder: 16,
      missingPerOrder: 4,
    });
  });
  it("supports a deal price and ignores one that is not cheaper", () => {
    expect(applyQuantityDeal(1000, { minPerOrder: 10, priceAgorot: 850 }, 40, 2)?.unitPriceAgorot).toBe(850);
    expect(applyQuantityDeal(800, { minPerOrder: 10, priceAgorot: 850 }, 40, 2)).toBeNull();
    expect(applyQuantityDeal(1000, undefined, 40, 2)).toBeNull();
  });
});
