import { describe, expect, it } from "vitest";
import { holdAmountAgorot, holdExpiry, holdState, luhnValid, paymentsProvider } from "./holds";

describe("card holds", () => {
  it("is a demo outside production and off in production until a provider is connected", () => {
    expect(paymentsProvider({ NODE_ENV: "development" })).toBe("demo");
    expect(paymentsProvider({ NODE_ENV: "production" })).toBeNull();
    expect(paymentsProvider({ NODE_ENV: "production", PAYMENTS_PROVIDER: "demo" })).toBe("demo");
    expect(paymentsProvider({ NODE_ENV: "development", PAYMENTS_PROVIDER: "off" })).toBeNull();
  });

  it("holds the first order including VAT, rounded up to a shekel", () => {
    // ₪4,000 לחודש ב-4 אספקות = ₪1,000 להזמנה, ₪1,180 עם מע״מ
    expect(holdAmountAgorot(400_000, 4)).toBe(118_000);
    expect(holdAmountAgorot(100_050, 1)).toBe(118_100);
    expect(holdAmountAgorot(0, 4)).toBe(100);
    expect(holdAmountAgorot(400_000, 0)).toBe(472_000);
  });

  it("expires after a week", () => {
    const at = new Date("2026-11-23T10:00:00Z");
    const hold = { status: "AUTHORIZED" as const, expiresAt: holdExpiry(at) };
    expect(holdState(hold, new Date("2026-11-29T10:00:00Z"))).toBe("active");
    expect(holdState(hold, new Date("2026-11-30T10:00:01Z"))).toBe("expired");
    expect(holdState({ status: "RELEASED", expiresAt: null })).toBe("released");
  });

  it("checks card numbers", () => {
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("4000000000000002")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
  });
});
