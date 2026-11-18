import { describe, expect, it } from "vitest";
import { CATEGORY_OF, effectivePref, hiddenCategories } from "./categories";
import { digestDue, weekKey } from "./jobs";
import { invoiceSavingsText } from "./invoice-savings";

describe("notification preferences", () => {
  it("keeps important notifications always on", () => {
    expect(effectivePref("CRITICAL", { inApp: false, email: "OFF" })).toEqual({ inApp: true, email: "INSTANT" });
  });
  it("uses defaults: savings daily, prices weekly, marketing off", () => {
    expect(effectivePref("SAVINGS")).toEqual({ inApp: true, email: "DAILY" });
    expect(effectivePref("PRICES")).toEqual({ inApp: true, email: "WEEKLY" });
    expect(effectivePref("MARKETING")).toEqual({ inApp: false, email: "OFF" });
    expect(effectivePref("OFFERS")).toEqual({ inApp: true, email: "INSTANT" });
  });
  it("ignores a frequency the category does not offer", () => {
    expect(effectivePref("OFFERS", { inApp: true, email: "WEEKLY" }).email).toBe("INSTANT");
  });
  it("hides categories turned off in the app, never critical", () => {
    const hidden = hiddenCategories([
      { category: "PRICES", inApp: false, email: "OFF" },
      { category: "CRITICAL", inApp: false, email: "OFF" },
    ]);
    expect(hidden).toEqual(["PRICES", "MARKETING"]);
  });
  it("puts every kind in a category", () => {
    expect(CATEGORY_OF.NEW_DEAL).toBe("MARKETING");
    expect(CATEGORY_OF.CHEAPER_SUPPLIER).toBe("SAVINGS");
    expect(CATEGORY_OF.OFFER_EXPIRING).toBe("CRITICAL");
  });
});

describe("digest timing", () => {
  // 2026-11-22 is a Sunday; 06:00 UTC = 08:00 in Israel
  const sunday8 = new Date("2026-11-22T06:00:00Z");
  const sunday6 = new Date("2026-11-22T04:00:00Z");
  const monday8 = new Date("2026-11-23T06:00:00Z");
  it("sends the daily digest once a day, from 7 in the morning", () => {
    expect(digestDue("DAILY", null, sunday8)).toBe(true);
    expect(digestDue("DAILY", null, sunday6)).toBe(false);
    expect(digestDue("DAILY", sunday8, new Date("2026-11-22T15:00:00Z"))).toBe(false);
    expect(digestDue("DAILY", sunday8, monday8)).toBe(true);
  });
  it("sends the weekly digest on Sunday only", () => {
    expect(digestDue("WEEKLY", null, sunday8)).toBe(true);
    expect(digestDue("WEEKLY", null, monday8)).toBe(false);
    expect(digestDue("WEEKLY", sunday8, new Date("2026-11-22T10:00:00Z"))).toBe(false);
  });
  it("keys a week by its Sunday", () => {
    expect(weekKey(monday8)).toBe("2026-11-22");
    expect(weekKey(sunday8)).toBe("2026-11-22");
  });
});

describe("invoice savings", () => {
  it("sums opportunities in one message", () => {
    const t = invoiceSavingsText(20, 85_000, "ספק א");
    expect(t.title).toBe("נמצאו 20 הזדמנויות לחיסכון בחשבונית מספק א");
    expect(t.body).toContain("850");
  });
});
