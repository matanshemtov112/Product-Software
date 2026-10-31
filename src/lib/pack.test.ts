import { describe, expect, it } from "vitest";
import { minBaseQuantity, minOrderLabel, nominalPackSize, packLabel, packPriceLabel, type PackInfo } from "./pack";

const entrecote: PackInfo = {
  unit: "KG",
  packType: "CARTON",
  packSize: 15,
  packSizeMax: 20,
  minQuantity: 0,
  minPacks: 1,
};

describe("pack labels", () => {
  it("describes a variable-weight carton and its minimum order", () => {
    expect(packLabel(entrecote)).toBe("קרטון 15–20 ק״ג");
    expect(minOrderLabel(entrecote)).toBe("1 × קרטון (15–20 ק״ג)");
  });
  it("describes loose products and plain minimums", () => {
    const loose: PackInfo = {
      unit: "KG",
      packType: null,
      packSize: 1,
      packSizeMax: null,
      minQuantity: 5,
      minPacks: null,
    };
    expect(packLabel(loose)).toBe("נמכר לפי ק״ג");
    expect(minOrderLabel(loose)).toBe("5 ק״ג");
    expect(minOrderLabel({ ...loose, minQuantity: 0 })).toBeNull();
  });
});

describe("pack math", () => {
  it("uses the middle of a weight range and converts a minimum in packs to base units", () => {
    expect(nominalPackSize(entrecote)).toBe(17.5);
    expect(minBaseQuantity({ ...entrecote, minPacks: 2 })).toBe(35);
    expect(minBaseQuantity({ ...entrecote, minPacks: null, minQuantity: 10 })).toBe(10);
  });
});

describe("packPriceLabel", () => {
  it("shows the price of a whole pack, and a range for variable weight", () => {
    const tin = { unit: "LITER", packType: "TIN", packSize: 4, packSizeMax: null } as const;
    expect(packPriceLabel(1800, tin)).toBe("₪72.00 לפח 4 ליטר");
    expect(packPriceLabel(13900, entrecote)).toBe("₪2,085.00–₪2,780.00 לקרטון 15–20 ק״ג");
  });
});
