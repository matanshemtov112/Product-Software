import { describe, expect, it } from "vitest";
import { parseIdentification } from "./identify";
import { groupMatches, type OfferRow } from "./match";

const catalog = ["פטריות שמפיניון", "כוסברה", "פטרוזיליה"];

describe("parseIdentification", () => {
  it("keeps only catalog names and removes duplicates between lists", () => {
    const result = parseIdentification(
      JSON.stringify({ description: " פטריות לבנות ", exact: ["פטריות שמפיניון", "פטריות יער"], similar: ["פטריות שמפיניון", "כוסברה", 5] }),
      catalog,
    );
    expect(result).toEqual({ kind: "ok", description: "פטריות לבנות", exact: ["פטריות שמפיניון"], similar: ["כוסברה"] });
  });

  it("reports an error for a reply that is not JSON", () => {
    expect(parseIdentification("not json", catalog).kind).toBe("error");
  });
});

describe("groupMatches", () => {
  const row = (productName: string, supplierId: string, priceAgorot: number | null): OfferRow => ({
    productId: productName,
    productName,
    unit: "KG",
    category: "ירוקים",
    supplierId,
    supplierName: supplierId,
    priceAgorot,
  });

  it("groups suppliers per product, cheapest first, unpriced last", () => {
    const { exact, similar } = groupMatches({ exact: ["פטריות שמפיניון"], similar: ["כוסברה", "פטרוזיליה"] }, [
      row("פטריות שמפיניון", "veg", 2400),
      row("פטריות שמפיניון", "noPrice", null),
      row("פטריות שמפיניון", "greens", 1650),
      row("כוסברה", "greens", 230),
    ]);
    expect(exact).toHaveLength(1);
    expect(exact[0].suppliers.map((s) => s.id)).toEqual(["greens", "veg", "noPrice"]);
    // פטרוזיליה לא נמכרת אצל אף ספק באזור ולכן לא מוצגת
    expect(similar.map((p) => p.productName)).toEqual(["כוסברה"]);
  });
});
