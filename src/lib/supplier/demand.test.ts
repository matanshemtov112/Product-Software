import { describe, expect, it } from "vitest";
import { allows } from "@/lib/billing/plans";
import { computeDemand, demandLevel, demandTrend, type CustomerPlace, type SupplierReach } from "./demand";

const now = new Date("2026-11-23T10:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const place = (id: string, regionId = "north"): CustomerPlace => ({ id, regionId, point: null });
const supplier = (id: string, productIds: string[], regionIds = ["north"]): SupplierReach => ({
  id,
  areas: [],
  regionIds,
  productIds: new Set(productIds),
});

describe("demand insights", () => {
  it("never reveals exact counts or fewer than 3 businesses", () => {
    expect(demandLevel(2)).toBeNull();
    expect(demandLevel(3)).toBe("3-5");
    expect(demandLevel(7)).toBe("6-10");
    expect(demandLevel(15)).toBe("11-20");
    expect(demandLevel(40)).toBe("20+");
  });

  it("detects new and rising demand", () => {
    expect(demandTrend(4, 0)).toBe("new");
    expect(demandTrend(6, 3)).toBe("rising");
    expect(demandTrend(4, 4)).toBe("steady");
  });

  it("counts distinct businesses in the supplier's area only", () => {
    const customers = new Map(["a", "b", "c", "d"].map((id) => [id, place(id)]));
    customers.set("far", place("far", "south"));
    const signals = [
      ...["a", "b", "c"].map((c) => ({ customerId: c, productId: "sugar", hasSupplier: true, day: daysAgo(1) })),
      // אותו עסק פעמיים נספר פעם אחת
      { customerId: "a", productId: "sugar", hasSupplier: true, day: daysAgo(2) },
      // עסק מחוץ לאזור לא נספר
      { customerId: "far", productId: "oil", hasSupplier: false, day: daysAgo(1) },
      ...["a", "b"].map((c) => ({ customerId: c, productId: "oil", hasSupplier: false, day: daysAgo(1) })),
      // אות ישן (לפני החלון) נספר רק כקודם
      { customerId: "d", productId: "sugar", hasSupplier: false, day: daysAgo(20) },
    ];
    const rows = computeDemand({
      supplier: supplier("me", ["sugar"]),
      others: [supplier("x", ["sugar"]), supplier("y", ["sugar"]), supplier("z", ["oil"], ["south"])],
      signals,
      customers,
      productFilter: null,
      now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productId: "sugar",
      level: "3-5",
      trend: "rising",
      sells: true,
      fewAlternatives: false,
      seekingAlternative: true,
    });
  });

  it("flags products the supplier doesn't sell and limits to its domains", () => {
    const customers = new Map(["a", "b", "c"].map((id) => [id, place(id)]));
    const signals = ["a", "b", "c"].flatMap((c) => [
      { customerId: c, productId: "flour", hasSupplier: false, day: daysAgo(3) },
      { customerId: c, productId: "fish", hasSupplier: false, day: daysAgo(3) },
    ]);
    const rows = computeDemand({
      supplier: supplier("me", []),
      others: [],
      signals,
      customers,
      productFilter: new Set(["flour"]),
      now,
    });
    expect(rows.map((r) => [r.productId, r.sells, r.fewAlternatives, r.trend])).toEqual([
      ["flour", false, true, "new"],
    ]);
  });
});

describe("subscription gate", () => {
  it("is open to everyone while the paywall is off", () => {
    expect(allows("demandInsights", [], false)).toBe(true);
  });
  it("needs an active paid plan once the paywall is on", () => {
    expect(allows("demandInsights", [], true, now)).toBe(false);
    expect(allows("demandInsights", [{ plan: "Basic", renewsAt: null }], true, now)).toBe(false);
    expect(allows("demandInsights", [{ plan: "Pro", renewsAt: daysAgo(1) }], true, now)).toBe(false);
    expect(allows("demandInsights", [{ plan: "Pro", renewsAt: null }], true, now)).toBe(true);
  });
});
