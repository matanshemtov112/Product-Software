import { describe, expect, it } from "vitest";
import { clientIpFrom, FLOOD_LIMITS, floodCheck, floodCheckRequest, SHARED_FACTOR } from "./flood";

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

describe("floodCheckRequest", () => {
  it("still blocks a flood that fakes a new X-Forwarded-For on every request", () => {
    const now = 10_000_000;
    let blocked = 0;
    for (let i = 0; i < FLOOD_LIMITS.writes * SHARED_FACTOR + 50; i++) {
      const h = new Headers({ "x-forwarded-for": `10.0.${Math.floor(i / 250)}.${i % 250}` });
      if (floodCheckRequest(h, true, now)) blocked++;
    }
    expect(blocked).toBe(50);
  });
});
