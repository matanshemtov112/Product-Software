import { db } from "@/lib/db";
import type { CatalogItem } from "@/app/customer/baskets/basket-builder";

/** הקטלוג הקנוני לבחירת מוצרים לסל (בלי מוצרים שממתינים לבדיקה) */
export async function catalogForBasket(): Promise<CatalogItem[]> {
  const products = await db.product.findMany({
    where: { pendingReview: false },
    include: {
      category: { include: { parent: true } },
      // השמות שספקים נותנים למוצר, כדי שלקוח ימצא אותו גם כשהוא מכיר אותו בשם של הספק שלו
      offers: { where: { available: true }, select: { supplierProductName: true, brand: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    category: p.category.name,
    parentCategory: p.category.parent?.name,
    aliases: [
      ...new Set([...p.aliases, ...p.offers.flatMap((o) => [o.supplierProductName, o.brand])].filter((a): a is string => Boolean(a))),
    ],
  }));
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
          product: { include: { category: { include: { parent: true } } } },
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
      product: {
        id: o.product.id,
        name: o.product.name,
        unit: o.product.unit,
        category: o.product.category.name,
        parentCategory: o.product.category.parent?.name,
        aliases: [o.supplierProductName, o.brand, ...o.product.aliases].filter((a): a is string => Boolean(a)),
        supplierName: o.supplierProductName ?? undefined,
      },
      priceAgorot: o.prices.find((p) => p.tierId === tierId)?.unitPriceAgorot ?? null,
    })),
  };
}
