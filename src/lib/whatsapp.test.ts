import { describe, expect, it } from "vitest";
import { dealMessage, internationalPhone, supplierWhatsapp, whatsappUrl } from "./whatsapp";

describe("whatsapp", () => {
  it("normalizes Israeli phone numbers", () => {
    expect(internationalPhone("050-123-4567")).toBe("972501234567");
    expect(internationalPhone("+972 50 1234567")).toBe("972501234567");
    expect(internationalPhone("00972-4-8123456")).toBe("97248123456");
    expect(internationalPhone("123")).toBeNull();
    expect(internationalPhone("")).toBeNull();
    expect(internationalPhone(null)).toBeNull();
  });

  it("builds a wa.me link with the message encoded", () => {
    expect(whatsappUrl("0501234567", "שלום & תודה")).toBe(
      `https://wa.me/972501234567?text=${encodeURIComponent("שלום & תודה")}`,
    );
    expect(whatsappUrl("abc", "x")).toBeNull();
  });

  it("uses the orders number, falls back to the contact phone, and respects the switch", () => {
    expect(supplierWhatsapp({ whatsappEnabled: true, whatsappPhone: "052-0000000", contactPhone: "050-1111111" })).toBe(
      "972520000000",
    );
    expect(supplierWhatsapp({ whatsappEnabled: true, whatsappPhone: null, contactPhone: "050-1111111" })).toBe(
      "972501111111",
    );
    expect(supplierWhatsapp({ whatsappEnabled: false, whatsappPhone: "052-0000000", contactPhone: null })).toBeNull();
    expect(supplierWhatsapp({ whatsappEnabled: true, whatsappPhone: null, contactPhone: null })).toBeNull();
  });

  it("writes the deal message with number, guarantee date and link", () => {
    const text = dealMessage({
      side: "CUSTOMER",
      number: "#1001",
      otherName: "בשרים הגליל",
      myName: "מסעדת דמו",
      until: "25.12.2026",
      url: "https://example.test/supplier/agreements/x",
    });
    expect(text).toContain("#1001");
    expect(text).toContain("מובטחים עד 25.12.2026");
    expect(text).toContain("https://example.test/supplier/agreements/x");
  });
});
