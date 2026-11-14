import { describe, expect, it } from "vitest";
import { basketItemsFromInvoice } from "./basket";
import { parseInvoice } from "./read";
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
    expect(result.kind === "ok" && [result.supplierName, result.invoiceDate]).toEqual([null, null]);
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
      { productId: "oil", monthlyQuantity: 96, currentUnitPriceAgorot: 1000 },
      { productId: "tomato", monthlyQuantity: 40, currentUnitPriceAgorot: null },
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
