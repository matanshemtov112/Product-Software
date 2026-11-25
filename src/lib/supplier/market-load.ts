import { priceAt, type PricePoint } from "@/lib/customer/monthly-report";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { packLabel } from "@/lib/pack";
import { marketPosition, type MarketPosition } from "./market";

export interface MarketRow {
  offerId: string;
  productName: string;
  unitLabel: string;
  category: string;
  ownAgorot: number;
  position: MarketPosition | null;
}

const select = {
  priceTiers: { orderBy: { minMonthlyAgorot: "asc" as const }, take: 1, select: { id: true } },
};

type PriceRow = Omit<PricePoint, "supplierId" | "productId"> & { tierId: string };

/** המחיר של ספק למוצר עכשיו, במחירון הבסיסי שלו */
function basePrice(prices: PriceRow[], tierId: string | undefined, now: Date) {
  if (!tierId) return null;
  return priceAt(
    prices.filter((p) => p.tierId === tierId).map((p) => ({ ...p, supplierId: "", productId: "" })),
    now,
  );
}

/** לכל מוצר של הספק: המחיר שלו והמיקום שלו מול ספקים אחרים שמוכרים את אותו מוצר */
export async function supplierMarket(supplierId: string, now = new Date()): Promise<MarketRow[]> {
  const priceWhere = { status: "LIVE" as const, validFrom: { lte: now } };
  const priceSelect = { tierId: true, unitPriceAgorot: true, kind: true, validFrom: true, validTo: true };
  const own = await db.supplier.findUniqueOrThrow({
    where: { id: supplierId },
    select: {
      ...select,
      offers: {
        where: { available: true },
        select: {
          id: true,
          productId: true,
          packType: true,
          packSize: true,
          packSizeMax: true,
          product: { select: { name: true, unit: true, category: { select: { name: true } } } },
          prices: { where: priceWhere, select: priceSelect },
        },
      },
    },
  });
  const productIds = own.offers.map((o) => o.productId);
  const others = await db.supplier.findMany({
    where: { id: { not: supplierId }, status: "APPROVED" },
    select: {
      ...select,
      offers: {
        where: { productId: { in: productIds }, available: true },
        select: { productId: true, prices: { where: priceWhere, select: priceSelect } },
      },
    },
  });
  const competitorPrices = new Map<string, number[]>();
  for (const s of others) {
    // ספק עם כמה אריזות לאותו מוצר נספר פעם אחת, במחיר הזול שלו
    const cheapest = new Map<string, number>();
    for (const o of s.offers) {
      const price = basePrice(o.prices, s.priceTiers[0]?.id, now);
      if (price !== null && price < (cheapest.get(o.productId) ?? Infinity)) cheapest.set(o.productId, price);
    }
    for (const [productId, price] of cheapest) {
      competitorPrices.set(productId, [...(competitorPrices.get(productId) ?? []), price]);
    }
  }
  const packCount = new Map<string, number>();
  for (const o of own.offers) packCount.set(o.productId, (packCount.get(o.productId) ?? 0) + 1);
  return own.offers
    .flatMap((o) => {
      const ownAgorot = basePrice(o.prices, own.priceTiers[0]?.id, now);
      if (ownAgorot === null) return [];
      return [
        {
          offerId: o.id,
          // כשיש לספק כמה אריזות למוצר, השם כולל את האריזה כדי להבדיל ביניהן
          productName:
            (packCount.get(o.productId) ?? 0) > 1
              ? `${o.product.name} (${packLabel({ ...o, unit: o.product.unit })})`
              : o.product.name,
          unitLabel: UNIT_LABEL[o.product.unit as keyof typeof UNIT_LABEL] ?? o.product.unit,
          category: o.product.category.name,
          ownAgorot,
          position: marketPosition(ownAgorot, competitorPrices.get(o.productId) ?? []),
        },
      ];
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "he"));
}
