import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { windowStart } from "@/lib/price-violations";
import { priceOn } from "@/lib/price-on";
import type { ViolationProduct } from "@/components/report/price-violation-button";

/**
 * המוצרים של ספק לטופס דיווח על הפרת מחיר, עם היסטוריית המחירים במדרגה הראשונה בתקופת הדיווח.
 * כולל מוצרים שהספק העביר לארכיון בתקופה הזו, כדי שאפשר יהיה לדווח גם עליהם.
 */
export async function violationProducts(supplierId: string, now = new Date()): Promise<ViolationProduct[]> {
  const since = windowStart(now);
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1, select: { id: true } } },
  });
  const tierId = supplier?.priceTiers[0]?.id;
  if (!tierId) return [];
  const offers = await db.supplierOffer.findMany({
    where: {
      supplierId,
      product: { pendingReview: false },
      OR: [{ archivedAt: null, available: true }, { archivedAt: { gte: since } }],
    },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      prices: {
        where: { status: "LIVE", tierId, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: since } }] },
        select: { validFrom: true, validTo: true, unitPriceAgorot: true },
      },
    },
    orderBy: { product: { name: "asc" } },
  });
  const byProduct = new Map<string, ViolationProduct>();
  for (const o of offers) {
    const entry = byProduct.get(o.product.id) ?? {
      id: o.product.id,
      name: o.product.name,
      unitLabel: UNIT_LABEL[o.product.unit] ?? o.product.unit,
      priceAgorot: null,
      history: [],
    };
    // מוצר שהועבר לארכיון: המחיר שלו נגמר ביום שהוצא מהרשימה
    const end = o.archivedAt;
    for (const p of o.prices) {
      const to = p.validTo && (!end || p.validTo < end) ? p.validTo : end;
      entry.history!.push({ from: p.validFrom.toISOString(), to: to?.toISOString() ?? null, price: p.unitPriceAgorot });
    }
    byProduct.set(o.product.id, entry);
  }
  const today = now.toISOString().slice(0, 10);
  return [...byProduct.values()].map((p) => ({ ...p, priceAgorot: priceOn(p.history ?? [], today) }));
}
