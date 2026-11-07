import { db } from "@/lib/db";
import { dealInput, dealLabel } from "@/lib/deal-label";
import type { QuantityDealInput } from "@/lib/engine/quantity-deal";
import { UNIT_LABEL } from "@/lib/format";
import { packLabel, packPriceLabel, pricedPerPack } from "@/lib/pack";

export interface CustomerDeal {
  offerId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  unitLabel: string;
  pack: string;
  /** המחיר הרגיל במחירון הבסיסי */
  regularAgorot: number | null;
  regularPackPrice?: string;
  /** מבצע מחיר עד תאריך */
  promotion: { priceAgorot: number; validTo: Date | null; packPrice?: string } | null;
  /** מבצע כמות */
  quantityDeal: (QuantityDealInput & { label: string }) | null;
  /** המוצר נמצא באחד הסלים של הלקוח */
  inMyBaskets: boolean;
}

/**
 * המבצעים שהלקוח יכול לראות: מבצעי מחיר ומבצעי כמות בתוקף, אצל ספקים מאושרים שמספקים לאזור שלו.
 * מוצרים שבסלים של הלקוח מופיעים ראשונים.
 */
export async function customerDeals(customerId: string, now = new Date()): Promise<CustomerDeal[]> {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { regionId: true, baskets: { select: { items: { select: { productId: true } } } } },
  });
  const mine = new Set(customer.baskets.flatMap((b) => b.items.map((i) => i.productId)));
  const valid = { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] };
  const offers = await db.supplierOffer.findMany({
    where: {
      available: true,
      product: { pendingReview: false },
      supplier: { status: "APPROVED", deliveryZones: { some: { regionId: customer.regionId } } },
      OR: [
        { quantityDeal: { OR: [{ validTo: null }, { validTo: { gt: now } }] } },
        { prices: { some: { status: "LIVE", kind: "PROMOTION", ...valid } } },
      ],
    },
    include: {
      product: true,
      quantityDeal: true,
      supplier: {
        select: {
          id: true,
          companyName: true,
          priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1, select: { id: true } },
        },
      },
      prices: { where: { status: "LIVE", ...valid }, orderBy: { validFrom: "desc" } },
    },
  });

  const deals: CustomerDeal[] = [];
  for (const o of offers) {
    const base = o.supplier.priceTiers[0]?.id;
    const tierPrices = o.prices.filter((p) => p.tierId === base);
    const regular = tierPrices.find((p) => p.kind === "REGULAR") ?? null;
    const promo = tierPrices.find((p) => p.kind === "PROMOTION") ?? null;
    const pack = { ...o, unit: o.product.unit };
    const unitLabel = UNIT_LABEL[o.product.unit];
    const packPrice = (agorot: number) => (pricedPerPack(o) ? packPriceLabel(agorot, pack) : undefined);
    const promotion =
      promo && (!regular || promo.unitPriceAgorot < regular.unitPriceAgorot)
        ? { priceAgorot: promo.unitPriceAgorot, validTo: promo.validTo, packPrice: packPrice(promo.unitPriceAgorot) }
        : null;
    const deal = o.quantityDeal && (!o.quantityDeal.validTo || o.quantityDeal.validTo > now) ? o.quantityDeal : null;
    if (!promotion && !deal) continue;
    deals.push({
      offerId: o.id,
      supplierId: o.supplier.id,
      supplierName: o.supplier.companyName,
      productId: o.productId,
      productName: o.product.name,
      unitLabel,
      pack: packLabel(pack),
      regularAgorot: regular?.unitPriceAgorot ?? null,
      regularPackPrice: regular ? packPrice(regular.unitPriceAgorot) : undefined,
      promotion,
      quantityDeal: deal ? { ...dealInput(deal), label: dealLabel(dealInput(deal), unitLabel) } : null,
      inMyBaskets: mine.has(o.productId),
    });
  }
  return deals.sort(
    (a, b) => Number(b.inMyBaskets) - Number(a.inMyBaskets) || a.productName.localeCompare(b.productName, "he"),
  );
}

/** פנייה בעקבות מבצע, כפי שנשמרת עם הפנייה ומוצגת לספק */
export interface DealInquirySnapshot {
  productName: string;
  unitLabel: string;
  pack: string;
  /** תיאור המבצע, למשל "מבצע כמות: מ-100 ליטר בהזמנה, ₪9.90 לליטר" */
  dealText: string;
  regularAgorot: number | null;
  /** הכמות שהלקוח רוצה בכל הזמנה, ביחידות בסיס */
  quantityPerOrder: number | null;
  deliveriesPerMonth: number | null;
}

export function isDealSnapshot(value: unknown): value is DealInquirySnapshot {
  return typeof value === "object" && value !== null && typeof (value as DealInquirySnapshot).dealText === "string";
}
