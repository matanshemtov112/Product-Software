import { db } from "@/lib/db";
import type { SheetOffer, SheetTier } from "./price-sheet";

/** המחירון הנוכחי של הספק (בלי מוצרים בארכיון): המחיר הרגיל שבתוקף בכל מדרגה */
export async function loadSheetOffers(supplierId: string, now = new Date()): Promise<SheetOffer[]> {
  const offers = await db.supplierOffer.findMany({
    where: { supplierId, archivedAt: null },
    include: {
      product: { select: { name: true, unit: true } },
      prices: {
        where: {
          status: "LIVE",
          kind: "REGULAR",
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ product: { name: "asc" } }, { packSize: "asc" }],
  });
  return offers.map((o) => {
    const prices: Record<string, number> = {};
    for (const p of o.prices) prices[p.tierId] ??= p.unitPriceAgorot;
    return {
      id: o.id,
      productName: o.product.name,
      supplierProductName: o.supplierProductName,
      brand: o.brand,
      supplierSku: o.supplierSku,
      barcode: o.barcode,
      available: o.available,
      unit: o.product.unit,
      packType: o.packType,
      packSize: o.packSize,
      packSizeMax: o.packSizeMax,
      pricePerPack: o.pricePerPack,
      prices,
    };
  });
}

export function loadSheetTiers(supplierId: string): Promise<SheetTier[]> {
  return db.priceTier.findMany({
    where: { supplierId },
    orderBy: { minMonthlyAgorot: "asc" },
    select: { id: true, name: true, minMonthlyAgorot: true },
  });
}
