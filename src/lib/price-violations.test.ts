import { describe, expect, it } from "vitest";
import { penalized, reportsToNextStage, violationStage } from "./price-violations";

describe("violationStage", () => {
  it("moves through the four stages at 7, 15, 25 and 40 reports", () => {
    expect(violationStage(0)).toBe(0);
    expect(violationStage(6)).toBe(0);
    expect(violationStage(7)).toBe(1);
    expect(violationStage(14)).toBe(1);
    expect(violationStage(15)).toBe(2);
    expect(violationStage(25)).toBe(3);
    expect(violationStage(39)).toBe(3);
    expect(violationStage(40)).toBe(4);
    expect(violationStage(100)).toBe(4);
  });
  it("counts what is missing for the next stage", () => {
    expect(reportsToNextStage(5)).toBe(2);
    expect(reportsToNextStage(15)).toBe(10);
    expect(reportsToNextStage(40)).toBeNull();
  });
});

describe("penalized", () => {
  it("lowers reliability but not below the floor", () => {
    expect(penalized(0.9)).toBe(0.6);
    expect(penalized(0.4)).toBe(0.3);
  });
});
