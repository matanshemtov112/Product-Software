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
    expect(r.suppliers.map((s) => [s.supplierId, s.products, s.monthlySavingAgorot])).toEqual([
      ["meat", ["chicken"], 20000],
      ["veg", ["onion"], 1200],
    ]);
    expect(r.monthlySavingAgorot).toBe(21200);
  });

  it("keeps products nobody in the system sells, without a saving", () => {
    const r = comparePaidPrices([item("rare", 5, 1000)], []);
    expect(r.lines[0].best).toBeNull();
    expect(r.suppliers).toEqual([]);
  });

  it("counts a cheaper supplier only after its minimum order and delivery", () => {
    // ספק אחד זול מאוד בעוף, אבל רק עוף ומינימום 1000 ₪; הספק הנוכחי כבר מעל המינימום שלו
    const items = [item("chicken", 40, 3700), item("oil", 20, 1500)];
    const offers = [offer("cheap", "chicken", 3000), offer("cur", "chicken", 3600), offer("cur", "oil", 1400)];
    const ctx = (min: number, deliveries: number) => ({
      terms: {
        cheap: { minOrderAgorot: min, feeAgorot: 5000, freeAboveAgorot: null },
        cur: { minOrderAgorot: 20000, feeAgorot: 5000, freeAboveAgorot: null },
      },
      deliveriesPerMonth: deliveries,
      currentSupplierId: "cur",
    });
    // 4 אספקות: 300 ₪ עוף בהזמנה, מתחת ל-1000 ₪
    const blocked = comparePaidPrices(items, offers, ctx(100000, 4));
    // הזול מופיע כחסום: אצלו ההזמנה 300 ₪ מול מינימום 1000 ₪
    expect(blocked.blocked.map((b) => [b.supplierId, b.reason, b.cost.shortfallPerOrderAgorot])).toEqual([
      ["cheap", "min-order", 70000],
    ]);
    // העוף עובר לספק הנוכחי (מחיר המחירון שלו זול ממה שהלקוח משלם), בלי משלוח נוסף
    expect(blocked.suppliers.map((s) => [s.supplierId, s.products, s.monthlySavingAgorot])).toEqual([
      ["cur", ["chicken", "oil"], 6000],
    ]);

    // בלי הצעה של הספק הנוכחי: הזול נחסם במינימום
    const only = comparePaidPrices(items, [offer("cheap", "chicken", 3000)], ctx(100000, 4));
    expect(only.suppliers).toEqual([]);
    expect(only.blocked.map((b) => [b.supplierId, b.reason, b.cost.shortfallPerOrderAgorot])).toEqual([
      ["cheap", "min-order", 70000],
    ]);
    expect(only.monthlySavingAgorot).toBe(0);

    // אספקה אחת בחודש: 1200 ₪ בהזמנה, עובר את המינימום; חיסכון 280 ₪ פחות 50 ₪ משלוח
    const once = comparePaidPrices(items, [offer("cheap", "chicken", 3000)], ctx(100000, 1));
    expect(once.suppliers.map((s) => [s.supplierId, s.monthlySavingAgorot])).toEqual([["cheap", 23000]]);
  });

  it("shows when delivery eats the whole saving", () => {
    const r = comparePaidPrices([item("onion", 10, 500)], [offer("veg", "onion", 450)], {
      terms: { veg: { minOrderAgorot: 0, feeAgorot: 3000, freeAboveAgorot: null } },
      deliveriesPerMonth: 4,
    });
    expect(r.suppliers).toEqual([]);
    expect(r.blocked[0].reason).toBe("delivery");
  });

  it("keeps the current supplier above its own minimum", () => {
    // הספק הנוכחי: מינימום 600 ₪. העברת העוף משאירה אצלו רק שמן ב-75 ₪ להזמנה
    const items = [item("chicken", 100, 3700), item("oil", 20, 1500)];
    const ctx = {
      terms: {
        meat: { minOrderAgorot: 40000, feeAgorot: 0, freeAboveAgorot: null },
        cur: { minOrderAgorot: 60000, feeAgorot: 0, freeAboveAgorot: null },
      },
      deliveriesPerMonth: 4,
      currentSupplierId: "cur",
    };
    const r = comparePaidPrices(items, [offer("meat", "chicken", 3300)], ctx);
    expect(r.suppliers).toEqual([]);
    expect(r.blocked.map((b) => [b.supplierId, b.reason, b.currentShortfallPerOrderAgorot])).toEqual([
      ["meat", "current-min", 52500],
    ]);
    // כשגם השמן עובר, לא נשאר כלום אצל הנוכחי ואין בעיה
    const all = comparePaidPrices(items, [offer("meat", "chicken", 3300), offer("meat", "oil", 1400)], ctx);
    expect(all.suppliers.map((s) => [s.supplierId, s.products])).toEqual([["meat", ["chicken", "oil"]]]);
  });
});
