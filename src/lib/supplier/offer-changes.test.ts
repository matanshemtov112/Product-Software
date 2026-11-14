import { describe, expect, it } from "vitest";
import { brandChangeNeedsDecision, diffOffer, offerChangeNote } from "./offer-changes";

const base = {
  brand: "סוגת",
  barcode: "7290000000011",
  supplierSku: "A1",
  supplierProductName: null,
  pack: "בקבוק 1 ל׳",
};

describe("offer changes", () => {
  it("a new barcode is logged without needing approval", () => {
    expect(diffOffer(base, { ...base, barcode: "7290000000028" })).toEqual([
      { kind: "BARCODE", oldValue: "7290000000011", newValue: "7290000000028" },
    ]);
  });

  it("a pack change is logged", () => {
    expect(diffOffer(base, { ...base, pack: "בקבוק 900 מ״ל" })).toEqual([
      { kind: "PACK", oldValue: "בקבוק 1 ל׳", newValue: "בקבוק 900 מ״ל" },
    ]);
  });

  it("another brand needs a decision; adding a missing brand or spacing does not", () => {
    expect(brandChangeNeedsDecision("סוגת", "ייבוא")).toBe(true);
    expect(brandChangeNeedsDecision("סוגת", "")).toBe(true);
    expect(brandChangeNeedsDecision("סוגת", " סוגת ")).toBe(false);
    expect(brandChangeNeedsDecision(null, "סוגת")).toBe(false);
    // הוספת מותג למוצר בלי מותג נרשמת ביומן
    expect(diffOffer({ ...base, brand: null }, base)).toEqual([{ kind: "BRAND", oldValue: null, newValue: "סוגת" }]);
    // שינוי מותג שמחייב החלטה לא נרשם כשינוי רגיל
    expect(diffOffer(base, { ...base, brand: "ייבוא" })).toEqual([]);
  });

  it("customers see a recent pack change or replacement, not an old one", () => {
    const now = new Date("2026-11-14");
    const offer = { brand: "ייבוא", packChangedAt: null, previousPackLabel: null, replaces: [] };
    expect(offerChangeNote(offer, "שק 25 ק״ג", now)).toBeUndefined();
    expect(
      offerChangeNote(
        { ...offer, replaces: [{ brand: "סוגת", archivedAt: new Date("2026-11-01") }] },
        "שק 25 ק״ג",
        now,
      ),
    ).toContain("הספק החליף את סוגת ב-ייבוא");
    expect(
      offerChangeNote(
        { ...offer, packChangedAt: new Date("2026-11-10"), previousPackLabel: "שק 50 ק״ג" },
        "שק 25 ק״ג",
        now,
      ),
    ).toContain("שק 50 ק״ג ← שק 25 ק״ג");
    expect(
      offerChangeNote(
        { ...offer, packChangedAt: new Date("2026-06-01"), previousPackLabel: "שק 50 ק״ג" },
        "שק 25 ק״ג",
        now,
      ),
    ).toBeUndefined();
  });
});
