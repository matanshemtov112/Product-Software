import { describe, expect, it } from "vitest";
import { optimizeBasket, quoteForSupplier, sameBrand, type BasketLine, type SupplierInput } from "@/lib/engine";
import { brandChoices } from "./quotes";

const ils = (n: number) => Math.round(n * 100);

/** ספק עם הצעות סוכר לפי מותג: [מותג, מחיר] */
function supplier(id: string, offers: [string | undefined, number][]): SupplierInput {
  return {
    id,
    name: id,
    minOrderAgorot: 0,
    rating: null,
    reliability: 0.9,
    delivery: { feeAgorot: 0, freeAboveAgorot: null },
    tiers: [{ id: `${id}-t0`, name: "רגיל", minMonthlyAgorot: 0 }],
    offers: offers.map(([brand, price], i) => ({
      offerId: `${id}-${i}`,
      productId: "sugar",
      packSize: 1,
      ...(brand ? { brand } : {}),
      prices: { [`${id}-t0`]: { unitPriceAgorot: ils(price), kind: "REGULAR" as const } },
    })),
  };
}

const opts = { preference: "PRICE" as const, deliveriesPerMonth: 4 };
const sugat = supplier("A", [["סוגת", 4.5]]);
const imported = supplier("B", [["ייבוא", 3.9]]);

function analyze(lines: BasketLine[], suppliers: SupplierInput[]) {
  const rows = suppliers
    .map((s) => ({ supplierId: s.id, supplierName: s.name, quote: quoteForSupplier(lines, suppliers, opts, s.id) }))
    .filter((r): r is typeof r & { quote: NonNullable<typeof r.quote> } => r.quote !== null);
  return { rows, choices: brandChoices(lines, suppliers, opts, rows, new Map([["sugar", "KG" as const]])) };
}

describe("brand preference", () => {
  it("matches brands ignoring spaces, case and quotes", () => {
    expect(sameBrand(" סוגת ", "סוגת")).toBe(true);
    expect(sameBrand("Sugat", "sugat")).toBe(true);
    expect(sameBrand("סוגת", "ייבוא")).toBe(false);
    expect(sameBrand(undefined, "סוגת")).toBe(false);
  });

  it("without a brand the cheapest sugar wins, whatever the brand", () => {
    const r = optimizeBasket([{ productId: "sugar", productName: "סוכר", quantity: 100 }], [sugat, imported], opts);
    expect(r.lowestCost!.suppliers[0].supplierId).toBe("B");
    expect(r.lowestCost!.suppliers[0].lines[0].brand).toBe("ייבוא");
  });

  it("with a brand only that brand counts as the same product, and the cheaper one is offered as similar", () => {
    const lines = [{ productId: "sugar", productName: "סוכר", quantity: 100, brand: "סוגת" }];
    const r = optimizeBasket(lines, [sugat, imported], opts);
    expect(r.lowestCost!.suppliers.map((s) => s.supplierId)).toEqual(["A"]);
    const { rows, choices } = analyze(lines, [sugat, imported]);
    expect(rows.map((x) => x.supplierId)).toEqual(["A"]);
    expect(choices).toHaveLength(1);
    expect(choices[0].exact).toMatchObject({ supplierId: "A", brand: "סוגת", unitPriceAgorot: 450 });
    expect(choices[0].similar).toMatchObject({ supplierId: "B", brand: "ייבוא", unitPriceAgorot: 390 });
    expect(choices[0].similarSavingAgorot).toBe(6000);
  });

  it("finds a cheaper other brand at the same supplier", () => {
    const both = supplier("C", [
      ["סוגת", 4.6],
      ["ייבוא", 4.0],
    ]);
    const lines = [{ productId: "sugar", productName: "סוכר", quantity: 10, brand: "סוגת" }];
    const { choices } = analyze(lines, [both]);
    expect(choices[0].exact?.unitPriceAgorot).toBe(460);
    expect(choices[0].similar).toMatchObject({ supplierId: "C", brand: "ייבוא", unitPriceAgorot: 400 });
  });

  it("shows no similar product when the chosen brand is already the cheapest", () => {
    const lines = [{ productId: "sugar", productName: "סוכר", quantity: 10, brand: "ייבוא" }];
    const { choices } = analyze(lines, [sugat, imported]);
    expect(choices[0].exact?.supplierId).toBe("B");
    expect(choices[0].similar).toBeNull();
  });

  it("when nobody sells the brand, the similar product is still shown", () => {
    const lines = [{ productId: "sugar", productName: "סוכר", quantity: 10, brand: "סוגת" }];
    const { choices } = analyze(lines, [imported]);
    expect(choices[0].exact).toBeNull();
    expect(choices[0].similar?.supplierId).toBe("B");
    expect(choices[0].similarSavingAgorot).toBeNull();
  });
});
