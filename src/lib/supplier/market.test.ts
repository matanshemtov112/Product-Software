import { describe, expect, it } from "vitest";
import { marketPosition } from "./market";

describe("marketPosition", () => {
  it("hides products with fewer than three suppliers", () => {
    expect(marketPosition(1000, [900])).toBeNull();
    expect(marketPosition(1000, [])).toBeNull();
  });
  it("cheapest when at or below every competitor", () => {
    expect(marketPosition(900, [900, 1000])).toEqual({ band: "CHEAPEST", rank: 1, suppliers: 3, medianAgorot: 900 });
  });
  it("bands by the gap above the cheapest competitor", () => {
    expect(marketPosition(1030, [1000, 1100])?.band).toBe("CLOSE");
    expect(marketPosition(1080, [1000, 1100])).toEqual({ band: "MID", rank: 2, suppliers: 3, medianAgorot: 1080 });
    expect(marketPosition(1200, [1000, 1100, 1150])).toEqual({
      band: "HIGH",
      rank: 4,
      suppliers: 4,
      medianAgorot: 1125,
    });
  });
});
