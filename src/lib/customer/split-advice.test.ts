import { describe, expect, it } from "vitest";
import { splitAdvice, type SplitRow } from "./split-advice";

const items = [
  { productId: "a", name: "עגבניות" },
  { productId: "b", name: "בצל" },
  { productId: "c", name: "חזה עוף" },
  { productId: "d", name: "אורז" },
];
const line = (productId: string, unit: number, total = unit * 10) => ({
  productId,
  unitPriceAgorot: unit,
  lineTotalAgorot: total,
});

describe("split advice", () => {
  it("is empty when one supplier covers the whole basket", () => {
    const rows: SplitRow[] = [
      {
        supplierId: "x",
        supplierName: "X",
        minOrderAgorot: 0,
        totalAgorot: 1,
        lines: ["a", "b", "c", "d"].map((p) => line(p, 100)),
      },
    ];
    expect(splitAdvice(items, rows, 4)).toBeNull();
  });

  it("names the missing products and where to buy them", () => {
    const rows: SplitRow[] = [
      {
        supplierId: "x",
        supplierName: "X",
        minOrderAgorot: 0,
        totalAgorot: 5000,
        lines: [line("a", 100), line("c", 300), line("d", 50)],
      },
      {
        supplierId: "y",
        supplierName: "Y",
        minOrderAgorot: 50000,
        totalAgorot: 4000,
        lines: [line("b", 90, 900), line("a", 120)],
      },
    ];
    const advice = splitAdvice(items, rows, 4)!;
    const x = advice.candidates[0];
    expect(x.supplierName).toBe("X");
    expect(x.missing.map((m) => m.name)).toEqual(["בצל"]);
    expect(x.missing[0].from?.supplierName).toBe("Y");
    expect(x.separate[0]).toMatchObject({ supplierName: "Y", perDeliveryAgorot: 225, belowMinimum: true });
  });

  it("lists products nobody sells", () => {
    const rows: SplitRow[] = [
      { supplierId: "x", supplierName: "X", minOrderAgorot: 0, totalAgorot: 1, lines: [line("a", 1), line("b", 1)] },
    ];
    const advice = splitAdvice(items, rows, 4)!;
    expect(advice.nobodySells).toEqual(["חזה עוף", "אורז"]);
    expect(advice.candidates).toEqual([]);
  });

  it("treats a supplier below its minimum order as a seller, not as missing", () => {
    const rows: SplitRow[] = [
      { supplierId: "x", supplierName: "X", minOrderAgorot: 0, totalAgorot: 1, lines: [line("a", 1), line("b", 1)] },
      {
        supplierId: "m",
        supplierName: "M",
        minOrderAgorot: 60000,
        totalAgorot: 2,
        lines: [line("a", 2), line("c", 2), line("d", 2)],
        belowMinimum: true,
      },
    ];
    const advice = splitAdvice(items, rows, 4)!;
    expect(advice.nobodySells).toEqual([]);
    const m = advice.candidates.find((c) => c.supplierId === "m")!;
    expect(m.belowMinimum).toBe(true);
    expect(m.missing.map((p) => p.name)).toEqual(["בצל"]);
  });
});
