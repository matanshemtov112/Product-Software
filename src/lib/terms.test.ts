import { describe, expect, it } from "vitest";
import {
  areaTermsText,
  deliveryFrequency,
  deliveryFrequencyText,
  normalizeCutoff,
  normalizeDays,
  parsePaymentTerms,
  publicPaymentTerms,
  timesPerWeekText,
} from "./terms";

describe("payment terms", () => {
  it("shows fixed terms, or that they are set per customer", () => {
    expect(publicPaymentTerms({ paymentTermsDays: 30, paymentTermsPerCustomer: false })).toBe("שוטף + 30");
    expect(publicPaymentTerms({ paymentTermsDays: 0, paymentTermsPerCustomer: false })).toBe("מזומן / בעת האספקה");
    expect(publicPaymentTerms({ paymentTermsDays: 30, paymentTermsPerCustomer: true })).toBe("נקבעים מול כל לקוח");
  });
  it("parses the per-customer choice", () => {
    expect(parsePaymentTerms("")).toBeNull();
    expect(parsePaymentTerms("60")).toBe(60);
    expect(parsePaymentTerms("7")).toBeUndefined();
  });
});

describe("delivery terms per area", () => {
  it("normalizes days and cutoff", () => {
    expect(normalizeDays(["ה", "א", "ג", "x"])).toBe("א,ג,ה");
    expect(normalizeDays([])).toBeNull();
    expect(normalizeCutoff("9:30")).toBe("09:30");
    expect(normalizeCutoff("25:00")).toBeNull();
  });
  it("describes the terms in one sentence", () => {
    expect(areaTermsText({ deliveryDays: "א,ג,ה", orderCutoff: "14:00" })).toBe(
      "אספקה בימים א׳, ג׳, ה׳. הזמנה עד 14:00 מגיעה באספקה הבאה.",
    );
    expect(areaTermsText({ deliveryDays: "א,ב,ג,ד,ה,ו", deliveryNote: "אספקה בקירור" })).toBe(
      "אספקה בכל יום א׳ עד ו׳. אספקה בקירור.",
    );
    expect(areaTermsText({})).toBeNull();
  });
});

describe("deliveryFrequency", () => {
  it("uses the weekly count when the supplier chose PER_WEEK, even if areas have days", () => {
    expect(deliveryFrequency("PER_WEEK", 3, "א,ב")).toEqual({ perWeek: 3, days: null });
    expect(deliveryFrequencyText(deliveryFrequency("PER_WEEK", 3, null))).toBe("3 פעמים בשבוע");
    expect(deliveryFrequency("PER_WEEK", 9, null)).toBeNull();
  });
  it("counts the area days otherwise", () => {
    expect(deliveryFrequencyText(deliveryFrequency("BY_AREA", null, "א,ג,ה"))).toBe("3 פעמים בשבוע (א׳, ג׳, ה׳)");
    expect(deliveryFrequencyText(deliveryFrequency(null, null, "ב"))).toBe("פעם בשבוע (ב׳)");
    expect(deliveryFrequencyText(deliveryFrequency("BY_AREA", null, "א,ב,ג,ד,ה,ו"))).toBe("כל יום, א׳ עד ו׳");
    expect(deliveryFrequency("BY_AREA", 4, "")).toBeNull();
  });
  it("words two deliveries naturally", () => {
    expect(timesPerWeekText(2)).toBe("פעמיים בשבוע");
  });
});
