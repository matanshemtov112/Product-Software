import { describe, expect, it } from "vitest";
import { clientIpFrom, FLOOD_LIMITS, floodCheck } from "./flood";

describe("floodCheck", () => {
  it("blocks writes over the per-minute limit and resets after a minute", () => {
    const ip = "test-writes";
    for (let i = 0; i < FLOOD_LIMITS.writes; i++) expect(floodCheck(ip, true, 1000)).toBe(0);
    expect(floodCheck(ip, true, 1000)).toBeGreaterThan(0);
    expect(floodCheck(ip, false, 61_001)).toBe(0);
  });
});

describe("clientIpFrom", () => {
  it("uses the last forwarded hop, not a client-supplied value", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 9.9.9.9", "x-real-ip": "6.6.6.6" });
    expect(clientIpFrom(h)).toBe("9.9.9.9");
  });
});
