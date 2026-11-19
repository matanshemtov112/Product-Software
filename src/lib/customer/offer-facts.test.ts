import { describe, expect, it } from "vitest";
import { areaText, minOrderText, validityText } from "./offer-facts";

describe("offer facts", () => {
  it("validity uses the earliest end date", () => {
    expect(validityText([{ priceKind: "LIST" }])).toBe("מחירון קבוע, בלי תאריך סיום");
    const t = validityText([
      { priceKind: "PROMOTION", priceValidTo: "2026-11-29T10:00:00Z" },
      { priceKind: "FIXED_TERM", priceValidTo: "2026-12-31T10:00:00Z" },
    ]);
    expect(t).toContain("המחירים בתוקף עד 29.11.2026");
    expect(
      validityText([{ priceKind: "PROMOTION", priceValidTo: "2026-11-29T10:00:00Z" }, { priceKind: "LIST" }]),
    ).toContain("מבצע על חלק מהמוצרים עד 29.11.2026");
  });

  it("describes the work area", () => {
    expect(areaText([{ label: "חיפה", radiusKm: 30 }], ["צפון"])).toBe("עד 30 ק״מ מחיפה");
    expect(areaText([], ["צפון", "מרכז"])).toBe("צפון, מרכז");
    expect(areaText([], [])).toBe("לא הוגדר");
  });

  it("minimum order", () => {
    expect(minOrderText(0)).toBe("אין מינימום");
    expect(minOrderText(50000)).toContain("500");
  });
});
