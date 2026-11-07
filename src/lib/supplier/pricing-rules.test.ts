import { describe, expect, it } from "vitest";
import { parseShekels, parseValidUntil, priceChangeStatus, validUntilInput } from "./pricing-rules";

describe("priceChangeStatus", () => {
  it("publishes a first price immediately", () => {
    expect(priceChangeStatus(null, 5000)).toBe("LIVE");
  });

  it("publishes changes up to 30% immediately", () => {
    expect(priceChangeStatus(1000, 1300)).toBe("LIVE");
    expect(priceChangeStatus(1000, 700)).toBe("LIVE");
  });

  it("holds changes above 30% for admin approval, up or down", () => {
    expect(priceChangeStatus(1000, 1301)).toBe("PENDING_APPROVAL");
    expect(priceChangeStatus(1000, 699)).toBe("PENDING_APPROVAL");
  });
});

describe("parseShekels", () => {
  it("parses shekel strings to agorot", () => {
    expect(parseShekels("34.90")).toBe(3490);
    expect(parseShekels("₪1,250")).toBe(125000);
  });

  it("rejects empty, zero and invalid values", () => {
    expect(parseShekels("")).toBeNull();
    expect(parseShekels("0")).toBeNull();
    expect(parseShekels("abc")).toBeNull();
    expect(parseShekels(null)).toBeNull();
  });
});

describe("parseValidUntil", () => {
  const now = new Date(2026, 10, 7, 12);
  it("ends at the start of the day after the chosen date", () => {
    expect(parseValidUntil("2026-11-30", now)).toEqual(new Date(2026, 11, 1));
    expect(parseValidUntil("2026-11-07", now)).toEqual(new Date(2026, 10, 8));
    expect(validUntilInput(new Date(2026, 11, 1))).toBe("2026-11-30");
  });
  it("rejects past, invalid and far dates", () => {
    expect(parseValidUntil("2026-11-06", now)).toBeNull();
    expect(parseValidUntil("2026-02-30", now)).toBeNull();
    expect(parseValidUntil("", now)).toBeNull();
    expect(parseValidUntil("2028-01-01", now)).toBeNull();
  });
});
