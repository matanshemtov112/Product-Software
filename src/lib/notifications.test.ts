import { describe, expect, it } from "vitest";
import { effectiveCost } from "./customer/effective-cost";
import { priceChangeNotifications, type PriceChange, type WatchedItem } from "./notifications";

const change = (oldAgorot: number | null, newAgorot: number): PriceChange => ({
  supplierId: "s1",
  supplierName: "בשרים",
  productId: "p1",
  productName: "חזה עוף",
  unitLabel: "ק״ג",
  oldAgorot,
  newAgorot,
});
const item = (over: Partial<WatchedItem>): WatchedItem => ({
  customerId: "c1",
  basketId: "b1",
  currentSupplierId: null,
  paidAgorot: 3700,
  monthlyQuantity: 10,
  delivers: true,
  ...over,
});

describe("priceChangeNotifications", () => {
  it("tells customers of this supplier when it raises or lowers a price", () => {
    const [up] = priceChangeNotifications(change(3000, 3300), [item({ currentSupplierId: "s1" })]);
    expect(up).toMatchObject({ customerId: "c1", kind: "PRICE_INCREASE" });
    expect(up.body).toContain("₪30.00");
    expect(up.body).toContain("₪33.00");
    expect(priceChangeNotifications(change(3300, 3000), [item({ currentSupplierId: "s1" })])[0].kind).toBe(
      "PRICE_DROP",
    );
    expect(priceChangeNotifications(change(null, 3000), [item({ currentSupplierId: "s1" })])).toEqual([]);
  });

  it("tells other customers when this supplier becomes cheaper than what they pay", () => {
    const [n] = priceChangeNotifications(change(3800, 3200), [item({})]);
    expect(n).toMatchObject({ kind: "CHEAPER_SUPPLIER", savingsAgorot: 5000 });
  });

  it("skips customers outside the delivery area, without a price, already cheaper, or not beaten", () => {
    expect(priceChangeNotifications(change(3800, 3200), [item({ delivers: false })])).toEqual([]);
    expect(priceChangeNotifications(change(3800, 3200), [item({ paidAgorot: null })])).toEqual([]);
    expect(priceChangeNotifications(change(3500, 3200), [item({})])).toEqual([]);
    expect(priceChangeNotifications(change(3800, 3700), [item({})])).toEqual([]);
  });

  it("sends one notification per customer even when the product is in several baskets", () => {
    const list = priceChangeNotifications(change(null, 3200), [item({}), item({ basketId: "b2" })]);
    expect(list).toHaveLength(1);
    expect(list[0].savingsAgorot).toBe(10000);
  });

  it("skips a cheaper supplier that is not worth it after minimum order and delivery", () => {
    const lines = [{ quantity: 10, unitPriceAgorot: 3200, paidAgorot: 3700 }];
    const blocked = effectiveCost(lines, { minOrderAgorot: 100000, feeAgorot: 0, freeAboveAgorot: null }, 4);
    expect(priceChangeNotifications(change(3800, 3200), [item({ switchCost: blocked })])).toEqual([]);
    const ok = effectiveCost(lines, { minOrderAgorot: 0, feeAgorot: 500, freeAboveAgorot: null }, 4);
    const [n] = priceChangeNotifications(change(3800, 3200), [item({ switchCost: ok })]);
    expect(n.savingsAgorot).toBe(3000);
    expect(n.body).toContain("כולל מינימום הזמנה");
  });
});
