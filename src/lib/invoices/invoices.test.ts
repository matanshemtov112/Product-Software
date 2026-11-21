import { describe, expect, it } from "vitest";
import { basketItemsFromInvoice } from "./basket";
import { discountPct, parseInvoice } from "./read";
import { suggestProduct } from "./suggest";

const catalog = ["שמן קנולה", "עגבניות", "חזה עוף טרי"];

describe("parseInvoice", () => {
  it("keeps catalog matches, converts shekels to agorot and lowers confidence for missing numbers", () => {
    const result = parseInvoice(
      JSON.stringify({
        supplierName: " סיטונאות הצפון ",
        invoiceDate: "2026-10-20",
        pricesIncludeVat: false,
        lines: [
          { text: "קנולה פח 18 ל׳", product: "שמן קנולה", quantity: 36, unitPrice: 9.5, confidence: "high", note: "" },
          { text: "עגבניה שרי", product: "עגבניות שרי", quantity: 5, unitPrice: 12, confidence: "high", note: "" },
          { text: "חזה עוף", product: "חזה עוף טרי", quantity: 0, unitPrice: 31, confidence: "high", note: "" },
          { text: "", product: "", quantity: 1, unitPrice: 1, confidence: "high", note: "" },
        ],
      }),
      catalog,
    );
    expect(result).toEqual({
      kind: "ok",
      supplierName: "סיטונאות הצפון",
      invoiceDate: "2026-10-20",
      discountPct: 0,
      lines: [
        {
          text: "קנולה פח 18 ל׳",
          productName: "שמן קנולה",
          quantity: 36,
          unitPriceAgorot: 950,
          confidence: "high",
          note: undefined,
        },
        {
          text: "עגבניה שרי",
          productName: null,
          quantity: 5,
          unitPriceAgorot: 1200,
          confidence: "high",
          note: undefined,
        },
        {
          text: "חזה עוף",
          productName: "חזה עוף טרי",
          quantity: null,
          unitPriceAgorot: 3100,
          confidence: "low",
          note: undefined,
        },
      ],
    });
  });

  it("removes VAT when the invoice prices include it", () => {
    const result = parseInvoice(
      JSON.stringify({
        supplierName: "",
        invoiceDate: "20/10/2026",
        pricesIncludeVat: true,
        lines: [
          { text: "עגבניות", product: "עגבניות", quantity: 10, unitPrice: 11.8, confidence: "medium", note: "בדקו" },
        ],
      }),
      catalog,
    );
    expect(result.kind === "ok" && result.lines[0].unitPriceAgorot).toBe(1000);
    // תאריך ישראלי (יום קודם) מנורמל
    expect(result.kind === "ok" && [result.supplierName, result.invoiceDate]).toEqual([null, "2026-10-20"]);
  });

  it("reports an error for a reply that is not JSON", () => {
    expect(parseInvoice("oops", catalog).kind).toBe("error");
  });
});

describe("basketItemsFromInvoice", () => {
  it("multiplies by invoices per month and merges repeated products with a weighted price", () => {
    expect(
      basketItemsFromInvoice(
        [
          { productId: "oil", quantity: 18, unitPriceAgorot: 900 },
          { productId: "oil", quantity: 6, unitPriceAgorot: 1300 },
          { productId: "tomato", quantity: 10, unitPriceAgorot: null },
          { productId: "skip", quantity: 0, unitPriceAgorot: 100 },
        ],
        4,
      ),
    ).toEqual([
      { productId: "oil", monthlyQuantity: 96, currentUnitPriceAgorot: 1000, preferredBrand: null },
      { productId: "tomato", monthlyQuantity: 40, currentUnitPriceAgorot: null, preferredBrand: null },
    ]);
  });
});

describe("suggestProduct", () => {
  const items = [
    { name: "שמן קנולה", aliases: ["קנולה פח"], categories: ["שמנים"] },
    { name: "עגבניות", aliases: [], categories: ["ירקות"] },
  ];
  it("finds the product even when the invoice line has pack sizes and extra words", () => {
    expect(suggestProduct("קנולה פח 18 ליטר מהדרין", items, (i) => i)?.name).toBe("שמן קנולה");
  });
  it("returns null when no word matches", () => {
    expect(suggestProduct("פיקדון ארגזים", items, (i) => i)).toBeNull();
  });
});

describe("brands from invoices", () => {
  it("reads the brand of each line", async () => {
    const { parseInvoice } = await import("./read");
    const result = parseInvoice(
      JSON.stringify({
        supplierName: "",
        invoiceDate: "",
        pricesIncludeVat: false,
        lines: [
          {
            text: "גבינת שמנת 5% גד",
            product: "גבינת שמנת",
            quantity: 10,
            unitPrice: 20,
            confidence: "high",
            note: "",
            brand: "גד",
          },
          { text: "סוכר", product: "סוכר", quantity: 5, unitPrice: 4, confidence: "high", note: "", brand: "" },
        ],
      }),
      ["גבינת שמנת", "סוכר"],
    );
    expect(result.kind === "ok" && result.lines.map((l) => l.brand)).toEqual(["גד", undefined]);
  });

  it("keeps a preferred brand only when every line of the product asks for it", async () => {
    const { basketItemsFromInvoice } = await import("./basket");
    const items = basketItemsFromInvoice(
      [
        { productId: "a", quantity: 1, unitPriceAgorot: 100, preferredBrand: "גד" },
        { productId: "a", quantity: 1, unitPriceAgorot: 100, preferredBrand: "גד" },
        { productId: "b", quantity: 1, unitPriceAgorot: 100, preferredBrand: "גד" },
        { productId: "b", quantity: 1, unitPriceAgorot: 100, preferredBrand: null },
      ],
      1,
    );
    expect(items.map((i) => i.preferredBrand)).toEqual(["גד", null]);
  });
});

describe("monthlyFromUsage", () => {
  it("turns weekly usage into monthly and keeps monthly as is", async () => {
    const { monthlyFromUsage } = await import("./basket");
    expect(monthlyFromUsage(5, "week")).toBe(21.65);
    expect(monthlyFromUsage(20, "month")).toBe(20);
  });
});

describe("invoice age", () => {
  it("classifies invoices by age and reads Israeli dates", async () => {
    const { invoiceAge, normalizeInvoiceDate, ageText } = await import("./age");
    expect(invoiceAge("2026-11-11", "2026-11-21")).toMatchObject({ kind: "fresh", days: 10 });
    expect(invoiceAge("2026-05-01", "2026-11-21").kind).toBe("old");
    expect(invoiceAge("2025-01-01", "2026-11-21").kind).toBe("too_old");
    expect(invoiceAge("2026-12-25", "2026-11-21").kind).toBe("future");
    expect(invoiceAge("2026-11-22", "2026-11-21").kind).toBe("fresh");
    expect(invoiceAge(null, "2026-11-21").kind).toBe("unknown");
    expect(invoiceAge("2026-02-30", "2026-11-21").kind).toBe("unknown");
    expect(normalizeInvoiceDate("03/11/2026")).toBe("2026-11-03");
    expect(normalizeInvoiceDate("3.11.26")).toBe("2026-11-03");
    expect(normalizeInvoiceDate("31/02/2026")).toBeNull();
    expect(ageText(invoiceAge("2026-07-21", "2026-11-21"))).toBe("לפני כ-4 חודשים");
  });
});

describe("invoice discounts", () => {
  it("reads a general invoice discount and line discounts", () => {
    const result = parseInvoice(
      JSON.stringify({
        supplierName: "",
        invoiceDate: "",
        invoiceDiscountPct: 5,
        pricesIncludeVat: false,
        lines: [
          {
            text: "עגבניות",
            product: "עגבניות",
            quantity: 10,
            unitPrice: 9,
            confidence: "high",
            note: "",
            lineDiscountPct: 10,
          },
          {
            text: "שמן",
            product: "שמן קנולה",
            quantity: 18,
            unitPrice: 9.5,
            confidence: "high",
            note: "",
            lineDiscountPct: 0,
          },
        ],
      }),
      catalog,
    );
    expect(result.kind === "ok" && result.discountPct).toBe(5);
    expect(result.kind === "ok" && result.lines.map((l) => l.lineDiscountPct)).toEqual([10, undefined]);
  });

  it("ignores impossible discounts", () => {
    expect(discountPct(150)).toBe(0);
    expect(discountPct(-3)).toBe(0);
    expect(discountPct("5")).toBe(0);
    expect(discountPct(7.456)).toBe(7.46);
  });
});

describe("quantity input helpers", () => {
  it("steps quantities and lists choices", async () => {
    const { stepQuantity, quantityChoices } = await import("@/components/quantity-input");
    expect(stepQuantity("3", 1)).toBe("4");
    expect(stepQuantity("1", -1)).toBe("0.5");
    expect(stepQuantity("0.5", -1)).toBe("");
    expect(stepQuantity("", 1)).toBe("1");
    expect(quantityChoices([12]).slice(0, 3)).toEqual([12, 1, 2]);
  });
});
