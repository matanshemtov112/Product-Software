import { describe, expect, it } from "vitest";
import { matchScore, normalize, searchItems, stem, type SearchFields } from "./search";

const products: SearchFields[] = [
  { name: "שמן קנולה", aliases: ["שמן לפתית", "קנולה פח 18 ל׳"], categories: ["מוצרים יבשים", "שמנים"] },
  { name: "שמן זית", aliases: ["כתית מעולה"], categories: ["מוצרים יבשים", "שמנים"] },
  { name: "שמנת מתוקה 32%", categories: ["מוצרי חלב"] },
  { name: "עגבניות", categories: ["פירות וירקות", "ירקות פרי"] },
  { name: "צ׳יפס קפוא", aliases: ["פריט 9 מ״מ"], categories: ["קפואים"] },
];
const names = (q: string) => searchItems(products, q, (p) => p).map((p) => p.name);

describe("normalize and stem", () => {
  it("handles final letters, niqqud, geresh and plurals", () => {
    expect(normalize("שֶׁמֶן")).toBe("שמנ");
    expect(normalize("צ׳יפס")).toBe("ציפס");
    expect(stem(normalize("עגבניות"))).toBe(stem(normalize("עגבניה")));
    expect(stem(normalize("שמנים"))).toBe("שמנ");
  });
});

describe("searchItems", () => {
  it("finds every oil for 'שמן' but not cream", () => {
    expect(names("שמן")).toEqual(["שמן קנולה", "שמן זית"]);
    expect(names("שמנים")).toEqual(["שמן קנולה", "שמן זית"]);
  });

  it("finds a product by the name a supplier uses", () => {
    expect(names("קנולה פח")).toEqual(["שמן קנולה"]);
    expect(names("פריט")).toEqual(["צ׳יפס קפוא"]);
    expect(names("כתית")).toEqual(["שמן זית"]);
  });

  it("matches singular to plural and partial words", () => {
    expect(names("עגבניה")).toEqual(["עגבניות"]);
    expect(names("עגב")).toEqual([]); // מילה קצרה חייבת להתאים במלואה
    expect(names("עגבנ")).toEqual(["עגבניות"]);
  });

  it("finds products by category, ranked below name matches", () => {
    expect(names("ירקות")).toEqual(["עגבניות"]);
    expect(matchScore(products[0], "שמן")).toBeGreaterThan(matchScore(products[0], "יבשים"));
  });

  it("returns everything for an empty query", () => {
    expect(names("  ")).toHaveLength(products.length);
  });
});
