import { describe, expect, it } from "vitest";
import { dealNumber, findBreaches, guaranteeEnd, isActive } from "./guarantees";

describe("price guarantee", () => {
  it("lasts 30 days from acceptance", () => {
    const at = new Date("2026-11-25T10:00:00Z");
    expect(guaranteeEnd(at).toISOString()).toBe("2026-12-25T10:00:00.000Z");
    expect(isActive({ guaranteedUntil: guaranteeEnd(at) }, new Date("2026-12-24T00:00:00Z"))).toBe(true);
    expect(isActive({ guaranteedUntil: guaranteeEnd(at) }, new Date("2026-12-26T00:00:00Z"))).toBe(false);
  });

  it("flags only invoice lines charged above the guaranteed price", () => {
    const prices = new Map([
      ["p1", { guaranteeId: "g", lineId: "l1", productName: "עגבניות", unitPriceAgorot: 500 }],
      ["p2", { guaranteeId: "g", lineId: "l2", productName: "מלפפון", unitPriceAgorot: 400 }],
    ]);
    const breaches = findBreaches(
      [
        { productId: "p1", unitPriceAgorot: 550 },
        { productId: "p2", unitPriceAgorot: 401 }, // עיגול של אגורה: לא חריגה
        { productId: "p3", unitPriceAgorot: 999 }, // לא במחיר מובטח
        { productId: "p1", unitPriceAgorot: null },
      ],
      prices,
    );
    expect(breaches).toEqual([
      { guaranteeId: "g", lineId: "l1", productName: "עגבניות", guaranteedAgorot: 500, chargedAgorot: 550 },
    ]);
  });

  it("formats the deal number", () => {
    expect(dealNumber(1)).toBe("#1001");
  });
});
