import { db } from "@/lib/db";
import type { CatalogItem } from "@/app/customer/baskets/basket-builder";

/** הקטלוג הקנוני לבחירת מוצרים לסל (בלי מוצרים שממתינים לבדיקה) */
export async function catalogForBasket(): Promise<CatalogItem[]> {
  const products = await db.product.findMany({
    where: { pendingReview: false },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, category: p.category.name }));
}

/** ספקים מאושרים שמספקים לאזור של הלקוח, לבחירת "הספק שלי היום" */
export async function suppliersInRegion(regionId: string) {
  return db.supplier.findMany({
    where: { status: "APPROVED", deliveryZones: { some: { regionId } }, offers: { some: { available: true } } },
    select: {
      id: true,
      companyName: true,
      _count: { select: { offers: { where: { available: true } } } },
      categories: { select: { category: { select: { name: true } } } },
      allCategories: true,
    },
    orderBy: { companyName: "asc" },
  });
}

/** המחירון של ספק אחד במדרגה הראשונה, כנקודת התחלה ל"המחיר שאני משלם היום" */
export async function supplierPriceList(supplierId: string, now = new Date()) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, status: "APPROVED" },
    include: {
      priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1 },
      offers: {
        where: { available: true, product: { pendingReview: false } },
        include: {
          product: { include: { category: true } },
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
        orderBy: { product: { name: "asc" } },
      },
    },
  });
  if (!supplier) return null;
  const tierId = supplier.priceTiers[0]?.id;
  return {
    id: supplier.id,
    name: supplier.companyName,
    items: supplier.offers.map((o) => ({
      product: { id: o.product.id, name: o.product.name, unit: o.product.unit, category: o.product.category.name },
      priceAgorot: o.prices.find((p) => p.tierId === tierId)?.unitPriceAgorot ?? null,
    })),
  };
}
