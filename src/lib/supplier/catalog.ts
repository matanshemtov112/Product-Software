import type { Prisma } from "@prisma/client";
import { categoryTree, expandCategoryIds } from "@/lib/categories";
import { db } from "@/lib/db";

export { UNIT_LABEL } from "@/lib/format";

/** הספק של המשתמש המחובר, או שגיאה אם המשתמש אינו מקושר לספק */
export async function supplierForUser(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      supplier: { include: { priceTiers: { orderBy: { minMonthlyAgorot: "asc" } }, categories: true } },
    },
  });
  if (!user.supplier) throw new Error("User is not linked to a supplier");
  return user.supplier;
}

/**
 * מזהי הסוגים שהספק עובד בהם, כולל תתי-התחומים של תחום ראשי שבחר במלואו,
 * או null כשהוא עובד בכל התחומים
 */
export async function domainCategoryIds(supplier: { allCategories: boolean; categories: { categoryId: string }[] }) {
  if (supplier.allCategories) return null;
  return expandCategoryIds(
    await categoryTree(),
    supplier.categories.map((c) => c.categoryId),
  );
}

/** כתובת התמונה של הצעה; הגרסה בכתובת מאפשרת שמירה ארוכה במטמון */
export function offerImageUrl(offer: { id: string; image: { updatedAt: Date } | null }) {
  return offer.image ? `/api/offer-images/${offer.id}?v=${offer.image.updatedAt.getTime()}` : null;
}

const offerInclude = {
  product: { include: { category: true } },
  prices: { orderBy: { createdAt: "desc" }, include: { tier: true } },
  image: { select: { updatedAt: true } },
} satisfies Prisma.SupplierOfferInclude;

export type OfferWithPrices = Prisma.SupplierOfferGetPayload<{ include: typeof offerInclude }>;

export async function listOffers(supplierId: string, filters: { q?: string; categoryId?: string }) {
  const q = filters.q?.trim();
  return db.supplierOffer.findMany({
    where: {
      supplierId,
      product: {
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
    },
    include: offerInclude,
    orderBy: { product: { name: "asc" } },
  });
}

export async function getOffer(supplierId: string, offerId: string) {
  return db.supplierOffer.findFirst({ where: { id: offerId, supplierId }, include: offerInclude });
}

/** סוגי המוצרים שיש לספק, עם מספר המוצרים בכל אחד, לסרגל הצד */
export async function categoryCounts(supplierId: string) {
  const offers = await db.supplierOffer.findMany({
    where: { supplierId },
    select: { product: { select: { category: { select: { id: true, name: true } } } } },
  });
  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const { product } of offers) {
    const c = counts.get(product.category.id) ?? { ...product.category, count: 0 };
    c.count++;
    counts.set(c.id, c);
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/** המחיר הפעיל העדכני ביותר והמחיר הממתין לאישור (אם יש) לכל מדרגה */
export function pricesByTier(offer: OfferWithPrices, now = new Date()) {
  const result = new Map<string, { live: number | null; pending: number | null; liveSince: Date | null }>();
  for (const p of offer.prices) {
    const entry = result.get(p.tierId) ?? { live: null, pending: null, liveSince: null };
    const valid = p.validFrom <= now && (!p.validTo || p.validTo > now);
    if (p.status === "LIVE" && valid && p.kind === "REGULAR" && entry.live === null) {
      entry.live = p.unitPriceAgorot;
      entry.liveSince = p.validFrom;
    }
    if (p.status === "PENDING_APPROVAL" && entry.pending === null && entry.live === null) {
      entry.pending = p.unitPriceAgorot;
    }
    result.set(p.tierId, entry);
  }
  return result;
}
