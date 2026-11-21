import { describe, expect, it } from "vitest";
import { effectiveCost, blockedReason } from "./effective-cost";

// ספק א': 18 ₪, מינימום 500 ₪, משלוח 50 ₪ · ספק ב': 19 ₪, בלי מינימום, משלוח חינם
const A = { minOrderAgorot: 50000, feeAgorot: 5000, freeAboveAgorot: null };
const B = { minOrderAgorot: 0, feeAgorot: 0, freeAboveAgorot: null };
const line = (quantity: number, unitPriceAgorot: number) => ({ quantity, unitPriceAgorot, paidAgorot: 2000 });

describe("effectiveCost", () => {
  it("compares the user's example: B wins below 50 units an order, A above", () => {
    const at = (q: number) => [effectiveCost([line(q, 1800)], A, 1), effectiveCost([line(q, 1900)], B, 1)];
    // 20 יחידות: אצל א' ההזמנה 360 ₪, מתחת למינימום
    const [a20] = at(20);
    expect(a20.feasible).toBe(false);
    expect(a20.shortfallPerOrderAgorot).toBe(14000);
    expect(blockedReason(a20)).toBe("min-order");
    // 30 יחידות: א' 540+50 = 590, ב' 570
    const [a30, b30] = at(30);
    expect([a30.totalAgorot, b30.totalAgorot]).toEqual([59000, 57000]);
    // 50 יחידות: שווה
    const [a50, b50] = at(50);
    expect(a50.totalAgorot).toBe(b50.totalAgorot);
    // 60 יחידות: א' 1130, ב' 1140
    const [a60, b60] = at(60);
    expect([a60.totalAgorot, b60.totalAgorot]).toEqual([113000, 114000]);
  });

  it("does not count a single cheap product below a 1000 ₪ minimum", () => {
    const c = effectiveCost(
      [{ quantity: 20, unitPriceAgorot: 3000, paidAgorot: 4500 }],
      { minOrderAgorot: 100000, feeAgorot: 0, freeAboveAgorot: null },
      4,
    );
    // 600 ₪ בחודש, 150 ₪ בהזמנה: חסרים 850 ₪ בכל הזמנה
    expect(c.productSavingAgorot).toBe(30000);
    expect(c.perOrderAgorot).toBe(15000);
    expect(c.shortfallPerOrderAgorot).toBe(85000);
    expect(c.worthIt).toBe(false);
  });

  it("adds delivery per order unless the order passes the free threshold", () => {
    const terms = { minOrderAgorot: 0, feeAgorot: 4000, freeAboveAgorot: 80000 };
    const small = effectiveCost([{ quantity: 40, unitPriceAgorot: 1000, paidAgorot: 1100 }], terms, 4);
    expect(small.deliveryAgorot).toBe(16000); // 4 × 40 ₪
    expect(small.netSavingAgorot).toBe(4000 - 16000);
    expect(blockedReason(small)).toBe("delivery");
    const big = effectiveCost([{ quantity: 400, unitPriceAgorot: 1000, paidAgorot: 1100 }], terms, 4);
    expect(big.deliveryAgorot).toBe(0);
    expect(big.worthIt).toBe(true);
  });

  it("adds nothing for a supplier the customer already orders from", () => {
    const c = effectiveCost([line(5, 1800)], A, 4, true);
    expect(c.deliveryAgorot).toBe(0);
    expect(c.feasible).toBe(true);
    expect(c.netSavingAgorot).toBe(1000);
  });
});
