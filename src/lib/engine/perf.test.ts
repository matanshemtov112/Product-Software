import { expect, it } from "vitest";
import { optimizeBasket } from "./optimize";
import type { SupplierInput } from "./types";

it("handles 40 suppliers and 50 items in under 5 seconds", () => {
  const items = Array.from({ length: 50 }, (_, i) => `p${i}`);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const suppliers: SupplierInput[] = Array.from({ length: 40 }, (_, s) => ({
    id: `s${s}`,
    name: `s${s}`,
    minOrderAgorot: 30000,
    rating: 3 + rnd() * 2,
    reliability: 0.8 + rnd() * 0.2,
    delivery: { feeAgorot: 5000, freeAboveAgorot: 150000 },
    tiers: [
      { id: `s${s}a`, name: "a", minMonthlyAgorot: 0 },
      { id: `s${s}b`, name: "b", minMonthlyAgorot: 1000000 },
    ],
    offers: items
      .filter(() => rnd() < 0.5)
      .map((p) => {
        const base = 1000 + Math.floor(rnd() * 5000);
        return {
          productId: p,
          packSize: 1,
          prices: {
            [`s${s}a`]: { unitPriceAgorot: base, kind: "REGULAR" as const },
            [`s${s}b`]: { unitPriceAgorot: Math.floor(base * 0.95), kind: "REGULAR" as const },
          },
        };
      }),
  }));
  const started = Date.now();
  const r = optimizeBasket(
    items.map((p) => ({ productId: p, productName: p, quantity: 20 })),
    suppliers,
    { preference: "BALANCED", deliveriesPerMonth: 4 },
  );
  expect(Date.now() - started).toBeLessThan(5000);
  expect(r.recommended?.missingProductIds).toEqual([]);
});
