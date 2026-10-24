import { describe, expect, it } from "vitest";
import { compareChecks, type CheckSnapshot } from "./checks";

const snap = (lowest: number, suppliers: Record<string, [number, number]>): CheckSnapshot => ({
  lowestCostAgorot: lowest,
  recommendedAgorot: lowest,
  suppliers: Object.fromEntries(
    Object.entries(suppliers).map(([id, [totalAgorot, items]]) => [id, { name: id, totalAgorot, items }]),
  ),
});

describe("compareChecks", () => {
  it("reports price drops and rises per supplier, biggest drop first", () => {
    const { lowestDeltaAgorot, changes } = compareChecks(
      snap(1000, { a: [1000, 5], b: [1200, 5], c: [900, 2] }),
      snap(950, { a: [1150, 5], b: [1000, 5], c: [900, 2] }),
    );
    expect(lowestDeltaAgorot).toBe(-50);
    expect(changes.map((c) => [c.supplierId, c.kind, c.beforeAgorot, c.afterAgorot])).toEqual([
      ["b", "changed", 1200, 1000],
      ["a", "changed", 1000, 1150],
    ]);
  });

  it("marks new suppliers, suppliers that left, and suppliers whose coverage changed", () => {
    const { changes } = compareChecks(snap(1000, { a: [1000, 5], gone: [1100, 5] }), snap(1000, { a: [800, 4], n: [990, 5] }));
    expect(Object.fromEntries(changes.map((c) => [c.supplierId, c.kind]))).toEqual({ a: "new", n: "new", gone: "gone" });
  });

  it("ignores changes under one shekel", () => {
    expect(compareChecks(snap(1000, { a: [1000, 5] }), snap(1000, { a: [1050, 5] })).changes).toEqual([]);
  });

  it("reports nothing when prices did not move", () => {
    const s = snap(1000, { a: [1000, 5] });
    expect(compareChecks(s, s)).toEqual({ lowestDeltaAgorot: 0, changes: [] });
  });
});
