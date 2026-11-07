import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
const { expandCategoryIds, selectableCategories } = await import("./categories");

const tree = [
  { id: "veg", name: "פירות וירקות", children: [{ id: "root", name: "ירקות אדמה" }, { id: "greens", name: "ירוקים" }] },
  { id: "eggs", name: "ביצים", children: [] },
];

describe("categories", () => {
  it("expands a whole category to its subcategories", () => {
    expect(expandCategoryIds(tree, ["veg"]).sort()).toEqual(["greens", "root", "veg"]);
    expect(expandCategoryIds(tree, ["greens"])).toEqual(["greens"]);
  });

  it("offers subcategories, or the category itself when it has none, limited to the supplier's domains", () => {
    expect(selectableCategories(tree, null)).toEqual([
      { group: "פירות וירקות", options: [{ id: "root", name: "ירקות אדמה" }, { id: "greens", name: "ירוקים" }] },
      { group: "ביצים", options: [{ id: "eggs", name: "ביצים" }] },
    ]);
    expect(selectableCategories(tree, ["greens"])).toEqual([
      { group: "פירות וירקות", options: [{ id: "greens", name: "ירוקים" }] },
    ]);
  });
});
