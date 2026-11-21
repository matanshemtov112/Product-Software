import { describe, expect, it } from "vitest";
import type { OfferWithPrices } from "./catalog";
import { offerPriceStats } from "./stats";

const now = new Date("2026-10-31T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const price = (status: string, validFrom: Date, tierId = "t1") => ({
  tierId,
  status,
  kind: "REGULAR",
  validFrom,
  validTo: null,
  unitPriceAgorot: 1000,
});
const offer = (prices: ReturnType<typeof price>[]) => ({ prices }) as unknown as OfferWithPrices;

describe("offerPriceStats", () => {
  it("counts products without a live price, pending prices and stale prices", () => {
    const stats = offerPriceStats(
      [
        offer([price("LIVE", daysAgo(3))]),
        offer([price("LIVE", daysAgo(45))]),
        offer([price("PENDING_APPROVAL", daysAgo(1))]),
        offer([]),
      ],
      now,
    );
    expect(stats).toEqual({ withoutPrice: 2, pendingPrice: 1, stalePrice: 1 });
  });
});
