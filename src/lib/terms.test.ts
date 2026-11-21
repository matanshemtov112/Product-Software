import { describe, expect, it } from "vitest";
import { areaTermsText, normalizeCutoff, normalizeDays, parsePaymentTerms, publicPaymentTerms } from "./terms";

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
