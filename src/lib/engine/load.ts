import { servingSupplierIds } from "@/lib/coverage";
import { db } from "@/lib/db";
import { minBaseQuantity, minOrderLabel, nominalPackSize, packLabel } from "@/lib/pack";
import { volumeScale } from "./optimize";
import { offerChangeNote } from "@/lib/supplier/offer-changes";
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
  const serving = await servingSupplierIds(basket.customer);

  const suppliers = await db.supplier.findMany({
    where: {
      id: { in: serving },
      offers: { some: { productId: { in: productIds }, available: true } },
    },
    include: {
      deliveryZones: { where: { regionId: basket.customer.regionId } },
      priceTiers: true,
      offers: {
        where: { productId: { in: productIds }, available: true },
        include: {
          product: { select: { unit: true } },
          quantityDeal: true,
          replaces: { select: { brand: true, archivedAt: true } },
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
    ...(i.preferredBrand ? { brand: i.preferredBrand } : {}),
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
      // ספק שמגיע לפי אזור על המפה אולי בלי אזור כללי; המשלוח חינם בכל מקרה
      delivery: { feeAgorot: zone?.feeAgorot ?? 0, freeAboveAgorot: zone?.freeAboveAgorot ?? null },
      tiers: s.priceTiers.map((t) => ({ id: t.id, name: t.name, minMonthlyAgorot: t.minMonthlyAgorot })),
      offers: s.offers.map((o) => {
        const prices: SupplierInput["offers"][number]["prices"] = {};
        // מבצע בתוקף גובר על מחיר רגיל אם הוא זול יותר; אחרת המחיר העדכני ביותר
        for (const p of o.prices.filter((x) => x.kind === "REGULAR")) {
          prices[p.tierId] ??= {
            unitPriceAgorot: p.unitPriceAgorot,
            kind: "REGULAR",
            updatedAt: p.validFrom.toISOString(),
            validTo: p.validTo?.toISOString(),
          };
        }
        for (const p of o.prices.filter((x) => x.kind === "PROMOTION")) {
          const current = prices[p.tierId];
          if (!current || p.unitPriceAgorot < current.unitPriceAgorot) {
            prices[p.tierId] = {
              unitPriceAgorot: p.unitPriceAgorot,
              kind: "PROMOTION",
              updatedAt: p.validFrom.toISOString(),
              validTo: p.validTo?.toISOString(),
              ...(current ? { regularAgorot: current.unitPriceAgorot } : {}),
            };
          }
        }
        const pack = { ...o, unit: o.product.unit };
        // אריזה שהשתנתה לאחרונה או מוצר חלופי: מסמנים ללקוח ליד המחיר
        const changeNote = offerChangeNote(o, packLabel(pack), now);
        return {
          offerId: o.id,
          productId: o.productId,
          packSize: nominalPackSize(o),
          ...(o.brand ? { brand: o.brand } : {}),
          ...(changeNote ? { changeNote } : {}),
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
          quantityDeal:
            o.quantityDeal && (!o.quantityDeal.validTo || o.quantityDeal.validTo > now)
              ? {
                  minPerOrder: o.quantityDeal.minPerOrder,
                  minPacks: o.quantityDeal.minPacks,
                  discountPct: o.quantityDeal.discountPct,
                  priceAgorot: o.quantityDeal.priceAgorot,
                  validTo: o.quantityDeal.validTo?.toISOString() ?? null,
                }
              : undefined,
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
