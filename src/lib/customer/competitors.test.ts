import { describe, expect, it } from "vitest";
import { findCompetitors, type PriceList } from "./competitors";

const p = (id: string) => ({ id, name: id, unit: "KG", category: "c" });
const list = (id: string, prices: Record<string, number | null>): PriceList => ({
  id,
  name: id,
  items: Object.entries(prices).map(([pid, priceAgorot]) => ({ product: p(pid), priceAgorot })),
});

describe("findCompetitors", () => {
  const current = list("mine", { a: 1000, b: 2000, c: 500, d: null });

  it("compares only shared, priced products and skips suppliers with no overlap", () => {
    const [x, ...rest] = findCompetitors(current, [
      current,
      list("x", { a: 900, b: 2200, z: 100 }),
      list("none", { z: 100, d: 50 }),
    ]);
    expect(rest).toHaveLength(0);
    expect(x.supplierId).toBe("x");
    expect(x.lines.map((l) => l.productId)).toEqual(["a", "b"]);
    expect(x.coverage).toBeCloseTo(2 / 3);
    expect(x.cheaperCount).toBe(1);
    expect(x.avgDiffPct).toBeCloseTo(0); // -10% ו-+10%
  });

  it("ranks by overlap first, then by how much cheaper", () => {
    const ranked = findCompetitors(current, [
      list("cheapOne", { a: 500 }),
      list("wide", { a: 1100, b: 2100, c: 550 }),
      list("wideCheap", { a: 900, b: 1800, c: 450 }),
    ]);
    expect(ranked.map((c) => c.supplierId)).toEqual(["wideCheap", "wide", "cheapOne"]);
  });

  it("returns nothing when the current supplier has no prices", () => {
    expect(findCompetitors(list("mine", { a: null }), [list("x", { a: 100 })])).toEqual([]);
  });
});
