import { describe, expect, it } from "vitest";
import { mergeItems } from "./summary";

describe("mergeItems", () => {
  const current = [
    { productId: "a", monthlyQuantity: 10, preferredBrand: "תנובה" },
    { productId: "b", monthlyQuantity: 5, preferredBrand: null },
  ];

  it("updates quantities, keeps a brand that wasn't mentioned, adds and removes", () => {
    expect(mergeItems(current, [{ productId: "a", monthlyQuantity: 20 }, { productId: "c", monthlyQuantity: 3 }], ["b"])).toEqual([
      { productId: "a", monthlyQuantity: 20, preferredBrand: "תנובה" },
      { productId: "c", monthlyQuantity: 3, preferredBrand: null },
    ]);
  });

  it("clears a brand when asked with an empty string or null", () => {
    expect(mergeItems(current, [{ productId: "a", monthlyQuantity: 10, preferredBrand: "" }], [])[0].preferredBrand).toBeNull();
    expect(mergeItems(current, [{ productId: "a", monthlyQuantity: 10, preferredBrand: null }], [])[0].preferredBrand).toBeNull();
  });

  it("dedupes repeated products, last one wins", () => {
    expect(mergeItems([], [{ productId: "x", monthlyQuantity: 1 }, { productId: "x", monthlyQuantity: 2 }], [])).toEqual([
      { productId: "x", monthlyQuantity: 2, preferredBrand: null },
    ]);
  });
});
