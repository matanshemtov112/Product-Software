import { describe, expect, it } from "vitest";
import { quoteChanges, seenQuote } from "./quote-changes";

const lines = [
  { productName: "חזה עוף", unitPriceAgorot: 3350 },
  { productName: "שמן קנולה", unitPriceAgorot: 950, brand: "א" },
];

describe("quote changes between page load and send", () => {
  it("nothing changed", () => {
    expect(quoteChanges(seenQuote(lines, 100000), { lines, total: 100000 })).toEqual([]);
  });

  it("price change, removed product and new total", () => {
    const changes = quoteChanges(seenQuote(lines, 100000), {
      lines: [{ productName: "חזה עוף", unitPriceAgorot: 3450 }],
      total: 99000,
    });
    expect(changes[0]).toContain("חזה עוף");
    expect(changes[0]).toContain("←");
    expect(changes[1]).toContain("שמן קנולה: הספק כבר לא מציע");
    expect(changes[2]).toContain("סה״כ");
  });

  it("brand replacement is called out", () => {
    const changes = quoteChanges(seenQuote(lines, 100000), {
      lines: [lines[0], { ...lines[1], brand: "ב" }],
      total: 100000,
    });
    expect(changes).toEqual([expect.stringContaining("המותג השתנה מ-א ל-ב")]);
  });

  it("ignores a missing or broken value", () => {
    expect(quoteChanges(null, { lines, total: 1 })).toEqual([]);
    expect(quoteChanges("{bad", { lines, total: 1 })).toEqual([]);
  });
});
