import { describe, expect, it } from "vitest";
import { priceOn } from "./price-on";

describe("price on a delivery date", () => {
  const periods = [
    { from: "2026-10-01T08:00:00Z", to: "2026-11-10T09:00:00Z", price: 3350 },
    { from: "2026-11-10T09:00:00Z", to: null, price: 3624 },
  ];
  it("uses the price valid that day", () => {
    expect(priceOn(periods, "2026-10-20")).toBe(3350);
    expect(priceOn(periods, "2026-11-12")).toBe(3624);
  });
  it("on the day of a change, uses the price that was in effect at the end of it", () => {
    expect(priceOn(periods, "2026-11-10")).toBe(3624);
  });
  it("a promotion valid alongside the regular price wins", () => {
    expect(
      priceOn([...periods, { from: "2026-11-11T00:00:00Z", to: "2026-11-20T00:00:00Z", price: 3000 }], "2026-11-12"),
    ).toBe(3000);
  });
  it("no price that day", () => {
    expect(priceOn(periods, "2026-09-01")).toBeNull();
  });
});
