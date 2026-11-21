import { describe, expect, it } from "vitest";
import { isValidIsraeliNumber } from "./business-number";

describe("isValidIsraeliNumber", () => {
  it("accepts numbers with a correct check digit", () => {
    expect(isValidIsraeliNumber("510000011")).toBe(true);
    expect(isValidIsraeliNumber("510000029")).toBe(true);
    expect(isValidIsraeliNumber("000000018")).toBe(true);
  });
  it("rejects a wrong check digit and bad input", () => {
    expect(isValidIsraeliNumber("510000012")).toBe(false);
    expect(isValidIsraeliNumber("51000001a")).toBe(false);
    expect(isValidIsraeliNumber("")).toBe(false);
  });
});
