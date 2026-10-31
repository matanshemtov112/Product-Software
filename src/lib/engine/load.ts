import { db } from "@/lib/db";
import { minBaseQuantity, minOrderLabel, nominalPackSize, packLabel } from "@/lib/pack";
import { volumeScale } from "./optimize";
import type { BasketLine, SupplierInput } from "./types";

/** מספר הביקורות המינימלי שממנו משתמשים בדירוג האמיתי של ספק */
export const MIN_REVIEWS_FOR_RATING = 5;

/**
 * טוען את הקלט למנוע עבור סל: הפריטים, והספקים המאושרים שמספקים לאזור של הלקוח,
 * עם המחיר העדכני לכל מדרגה. מחירים שממתינים לאישור או שתוקפם פג לא נכללים.
 */
export async function loadEngineInput(basketId: string, now = new Date()) {
  const basket = await db.basket.findUniqueOrThrow({
    where: { id: basketId },
    include: { customer: true, items: { include: { product: { include: { category: true } } } } },
  });
  const productIds = basket.items.map((i) => i.productId);

  const suppliers = await db.supplier.findMany({
    where: {
      status: "APPROVED",
      deliveryZones: { some: { regionId: basket.customer.regionId } },
      offers: { some: { productId: { in: productIds }, available: true } },
    },
    include: {
      deliveryZones: { where: { regionId: basket.customer.regionId } },
      priceTiers: true,
      offers: {
        where: { productId: { in: productIds }, available: true },
        include: {
          product: { select: { unit: true } },
          prices: {
            where: {
              status: "LIVE",
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gt: now } }],
            },
            orderBy: { validFrom: "desc" },
          },
        },
      },
      reviews: { where: { status: "PUBLISHED" }, select: { overall: true } },
    },
  });

  const lines: BasketLine[] = basket.items.map((i) => ({
    productId: i.productId,
    productName: i.product.name,
    quantity: i.monthlyQuantity,
    excludedSupplierIds: i.excludedSupplierIds,
  }));

  const supplierInputs: SupplierInput[] = suppliers.map((s) => {
    const zone = s.deliveryZones[0];
    const rating =
      s.reviews.length >= MIN_REVIEWS_FOR_RATING
        ? s.reviews.reduce((sum, r) => sum + r.overall, 0) / s.reviews.length
        : null;
    return {
      id: s.id,
      name: s.companyName,
      minOrderAgorot: s.minOrderAgorot,
      rating,
      reliability: s.reliability,
      delivery: { feeAgorot: zone.feeAgorot, freeAboveAgorot: zone.freeAboveAgorot },
      tiers: s.priceTiers.map((t) => ({ id: t.id, name: t.name, minMonthlyAgorot: t.minMonthlyAgorot })),
      offers: s.offers.map((o) => {
        const prices: SupplierInput["offers"][number]["prices"] = {};
        // מבצע בתוקף גובר על מחיר רגיל אם הוא זול יותר; אחרת המחיר העדכני ביותר
        for (const p of o.prices.filter((x) => x.kind === "REGULAR")) {
          prices[p.tierId] ??= {
            unitPriceAgorot: p.unitPriceAgorot,
            kind: "REGULAR",
            updatedAt: p.validFrom.toISOString(),
          };
        }
        for (const p of o.prices.filter((x) => x.kind === "PROMOTION")) {
          const current = prices[p.tierId];
          if (!current || p.unitPriceAgorot < current.unitPriceAgorot) {
            prices[p.tierId] = {
              unitPriceAgorot: p.unitPriceAgorot,
              kind: "PROMOTION",
              updatedAt: p.validFrom.toISOString(),
            };
          }
        }
        const pack = { ...o, unit: o.product.unit };
        return {
          productId: o.productId,
          packSize: nominalPackSize(o),
          minQuantity: minBaseQuantity(pack),
          packLabel: packLabel(pack),
          minOrderLabel: minOrderLabel(pack),
          packInfo: {
            unit: pack.unit,
            packType: o.packType,
            packSize: o.packSize,
            packSizeMax: o.packSizeMax,
            pricePerPack: o.pricePerPack,
          },
          prices,
        };
      }),
    };
  });

  const currentCostAgorot = basket.items.every((i) => i.currentUnitPriceAgorot !== null)
    ? Math.round(basket.items.reduce((sum, i) => sum + i.monthlyQuantity * (i.currentUnitPriceAgorot ?? 0), 0))
    : null;

  return {
    basket,
    lines,
    suppliers: supplierInputs,
    options: {
      preference: basket.customer.preference,
      deliveriesPerMonth: basket.deliveriesPerMonth,
      // לפי הגבול התחתון של הטווח, כדי לא להבטיח מחירים שהלקוח לא בטוח זכאי להם
      volumeScale: volumeScale(lines, supplierInputs, basket.monthlyVolumeMinAgorot),
      currentCostAgorot,
    },
  };
}
