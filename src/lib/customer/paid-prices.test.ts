import { describe, expect, it } from "vitest";
import { comparePaidPrices, type PaidItem, type SystemOffer } from "./paid-prices";

const item = (productId: string, quantity: number, paidAgorot: number | null): PaidItem => ({
  productId,
  productName: productId,
  unit: "KG",
  quantity,
  paidAgorot,
});
const offer = (supplierId: string, productId: string, unitPriceAgorot: number): SystemOffer => ({
  supplierId,
  supplierName: supplierId,
  productId,
  unitPriceAgorot,
});

describe("comparePaidPrices", () => {
  it("finds the cheapest offer per product and the monthly saving", () => {
    const r = comparePaidPrices(
      [item("chicken", 50, 3700), item("beef", 30, 6000), item("onion", 15, 490), item("noPrice", 10, null)],
      [
        offer("meat", "chicken", 3300),
        offer("center", "chicken", 3500),
        offer("meat", "beef", 6200),
        offer("veg", "onion", 410),
        offer("veg", "noPrice", 100),
      ],
    );
    expect(r.lines.map((l) => [l.productId, l.best?.supplierId, l.monthlySavingAgorot])).toEqual([
      ["chicken", "meat", 20000],
      ["onion", "veg", 1200],
      ["beef", "meat", 0], // הלקוח משלם היום פחות
    ]);
    expect(r.suppliers).toEqual([
      { supplierId: "meat", supplierName: "meat", products: ["chicken"], monthlySavingAgorot: 20000 },
      { supplierId: "veg", supplierName: "veg", products: ["onion"], monthlySavingAgorot: 1200 },
    ]);
    expect(r.monthlySavingAgorot).toBe(21200);
  });

  it("keeps products nobody in the system sells, without a saving", () => {
    const r = comparePaidPrices([item("rare", 5, 1000)], []);
    expect(r.lines[0].best).toBeNull();
    expect(r.suppliers).toEqual([]);
  });
});
