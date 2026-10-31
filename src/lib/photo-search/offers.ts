import { db } from "@/lib/db";
import { hasPack, packLabel, packPriceLabel } from "@/lib/pack";
import type { OfferRow } from "./match";

/** הצעות פעילות למוצרים שזוהו, אצל ספקים מאושרים שמספקים לאזור, עם המחיר במדרגה הבסיסית */
export async function offersForProducts(names: string[], regionId: string, now = new Date()): Promise<OfferRow[]> {
  if (names.length === 0) return [];
  const offers = await db.supplierOffer.findMany({
    where: {
      available: true,
      product: { name: { in: names }, pendingReview: false },
      supplier: { status: "APPROVED", deliveryZones: { some: { regionId } } },
    },
    include: {
      product: { include: { category: true } },
      supplier: {
        select: { id: true, companyName: true, priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1 } },
      },
      prices: {
        where: {
          status: "LIVE",
          kind: "REGULAR",
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: "desc" },
      },
    },
  });
  return offers.map((o) => {
    const priceAgorot = o.prices.find((p) => p.tierId === o.supplier.priceTiers[0]?.id)?.unitPriceAgorot ?? null;
    const pack = { ...o, unit: o.product.unit };
    return {
      productId: o.product.id,
      productName: o.product.name,
      unit: o.product.unit,
      category: o.product.category.name,
      supplierId: o.supplier.id,
      supplierName: o.supplier.companyName,
      priceAgorot,
      // מחיר לאריזה כשיש, אחרת רק איך המוצר מגיע
      pack: priceAgorot !== null && hasPack(pack) ? packPriceLabel(priceAgorot, pack) : packLabel(pack),
    };
  });
}
