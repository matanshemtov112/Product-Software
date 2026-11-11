import type { NotificationKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveCost, type EffectiveCost } from "@/lib/customer/effective-cost";
import { priceAt } from "@/lib/customer/monthly-report";
import { shekels } from "@/lib/format";
import { servesCustomer } from "@/lib/geo";

export interface NewNotification {
  customerId?: string;
  supplierId?: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href: string;
  savingsAgorot?: number;
  dedupeKey?: string;
}

/** שומר התראות; התראה עם אותו dedupeKey נשמרת פעם אחת בלבד */
export async function notify(items: NewNotification[]) {
  if (items.length === 0) return;
  await db.notification.createMany({ data: items as Prisma.NotificationCreateManyInput[], skipDuplicates: true });
}

/** פריט בסל של לקוח, כפי שנבדק מול שינוי מחיר של ספק */
export interface WatchedItem {
  customerId: string;
  basketId: string;
  /** הספק הנוכחי של הסל, אם רשום במערכת */
  currentSupplierId: string | null;
  /** המחיר ליחידה שהלקוח משלם היום; null אם לא מילא */
  paidAgorot: number | null;
  monthlyQuantity: number;
  /** הספק מספק לאזור של הלקוח */
  delivers: boolean;
  /**
   * העלות האפקטיבית אם הלקוח מעביר לספק את כל המוצרים מהסל שזולים אצלו (כולל משלוח ומינימום הזמנה).
   * בלי זה ההשוואה לפי מחיר ליחידה בלבד.
   */
  switchCost?: EffectiveCost;
}

export interface PriceChange {
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  unitLabel: string;
  oldAgorot: number | null;
  newAgorot: number;
}

/**
 * מי צריך לשמוע על שינוי מחיר של ספק:
 * - הספק הנוכחי של הלקוח העלה או הוריד מחיר.
 * - ספק אחר מוכר עכשיו בפחות ממה שהלקוח משלם (ולא מכר כך קודם).
 * לקוח מקבל התראה אחת לכל מוצר ושינוי, גם אם המוצר בכמה סלים.
 */
export function priceChangeNotifications(change: PriceChange, items: WatchedItem[]): NewNotification[] {
  const { supplierId, supplierName, productId, productName, unitLabel, oldAgorot, newAgorot } = change;
  const price = (a: number) => `${shekels(a, 2)} ל${unitLabel}`;
  const out = new Map<string, NewNotification>();
  for (const item of items) {
    const href = `/customer/baskets/${item.basketId}`;
    if (item.currentSupplierId === supplierId) {
      if (oldAgorot === null || oldAgorot === newAgorot) continue;
      const up = newAgorot > oldAgorot;
      const key = `${up ? "up" : "down"}:${item.customerId}:${supplierId}:${productId}:${newAgorot}`;
      if (!out.has(key))
        out.set(key, {
          customerId: item.customerId,
          kind: up ? "PRICE_INCREASE" : "PRICE_DROP",
          title: `${supplierName} ${up ? "העלה" : "הוריד"} את המחיר של ${productName}`,
          body: `מ-${price(oldAgorot)} ל-${price(newAgorot)} במחירון.`,
          href,
          dedupeKey: key,
        });
      continue;
    }
    if (!item.delivers || item.paidAgorot === null || newAgorot >= item.paidAgorot) continue;
    if (oldAgorot !== null && oldAgorot < item.paidAgorot) continue; // כבר היה זול יותר, הלקוח יודע
    // זול ליחידה אבל לא משתלם אחרי משלוח ומינימום הזמנה: לא מתריעים
    if (item.switchCost && !item.switchCost.worthIt) continue;
    const key = `cheaper:${item.customerId}:${supplierId}:${productId}:${newAgorot}`;
    const saving = item.switchCost
      ? item.switchCost.netSavingAgorot
      : Math.round((item.paidAgorot - newAgorot) * item.monthlyQuantity);
    const prev = out.get(key);
    if (prev) {
      prev.savingsAgorot = (prev.savingsAgorot ?? 0) + saving;
      continue;
    }
    out.set(key, {
      customerId: item.customerId,
      kind: "CHEAPER_SUPPLIER",
      title: `נמצא מחיר זול יותר ל${productName}`,
      body: `${supplierName} מוכר ב-${price(newAgorot)}, ואתם משלמים היום ${price(item.paidAgorot)}.${
        item.switchCost ? ` כולל מינימום הזמנה: חיסכון של ${shekels(saving)} בחודש.` : ""
      }`,
      href,
      savingsAgorot: saving,
      dedupeKey: key,
    });
  }
  return [...out.values()];
}

/** בודק שינוי מחיר במדרגה הבסיסית של ספק ושולח התראות ללקוחות הרלוונטיים */
export async function notifyPriceChange(change: PriceChange) {
  const [items, supplier] = await Promise.all([
    db.basketItem.findMany({
      where: { productId: change.productId },
      select: {
        basketId: true,
        monthlyQuantity: true,
        currentUnitPriceAgorot: true,
        basket: {
          select: {
            customerId: true,
            currentSupplierId: true,
            deliveriesPerMonth: true,
            customer: { select: { regionId: true, lat: true, lng: true } },
            items: { select: { productId: true, monthlyQuantity: true, currentUnitPriceAgorot: true } },
          },
        },
      },
    }),
    db.supplier.findUnique({
      where: { id: change.supplierId },
      select: {
        minOrderAgorot: true,
        deliveryZones: { select: { regionId: true, feeAgorot: true, freeAboveAgorot: true } },
        deliveryAreas: { select: { lat: true, lng: true, radiusKm: true } },
        priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1, select: { id: true } },
        offers: {
          where: { available: true },
          select: {
            productId: true,
            prices: {
              where: { status: "LIVE" },
              select: { tierId: true, unitPriceAgorot: true, kind: true, validFrom: true, validTo: true },
            },
          },
        },
      },
    }),
  ]);
  if (!supplier) return;
  // המחיר הנוכחי של הספק לכל מוצר, במחירון הבסיסי; המוצר שהשתנה לפי המחיר החדש
  const now = new Date();
  const baseTier = supplier.priceTiers[0]?.id;
  const prices = new Map<string, number>();
  for (const o of supplier.offers) {
    const points = o.prices
      .filter((p) => p.tierId === baseTier)
      .map((p) => ({ ...p, supplierId: change.supplierId, productId: o.productId }));
    const price = priceAt(points, now);
    // כמה אריזות לאותו מוצר: המחיר הזול לק״ג
    if (price !== null && price < (prices.get(o.productId) ?? Infinity)) prices.set(o.productId, price);
  }
  prices.set(change.productId, Math.min(prices.get(change.productId) ?? Infinity, change.newAgorot));
  const zones = new Map(supplier.deliveryZones.map((z) => [z.regionId, z]));
  const coverage = { areas: supplier.deliveryAreas, regionIds: [...zones.keys()] };

  await notify(
    priceChangeNotifications(
      change,
      items.map((i) => {
        const { regionId, lat, lng } = i.basket.customer;
        const reaches = servesCustomer(coverage, { regionId, point: lat != null && lng != null ? { lat, lng } : null });
        // המשלוח חינם; האזור הכללי (אם יש) משמש רק לתנאים הישנים, ובלעדיו התנאים ריקים
        const zone = reaches ? (zones.get(regionId) ?? { feeAgorot: 0, freeAboveAgorot: null }) : undefined;
        const lines = i.basket.items.flatMap((b) => {
          const price = prices.get(b.productId);
          return price !== undefined && b.currentUnitPriceAgorot !== null && price < b.currentUnitPriceAgorot
            ? [{ quantity: b.monthlyQuantity, unitPriceAgorot: price, paidAgorot: b.currentUnitPriceAgorot }]
            : [];
        });
        return {
          customerId: i.basket.customerId,
          basketId: i.basketId,
          currentSupplierId: i.basket.currentSupplierId,
          paidAgorot: i.currentUnitPriceAgorot,
          monthlyQuantity: i.monthlyQuantity,
          delivers: !!zone,
          switchCost:
            zone && lines.length
              ? effectiveCost(
                  lines,
                  {
                    minOrderAgorot: supplier.minOrderAgorot,
                    feeAgorot: zone.feeAgorot,
                    freeAboveAgorot: zone.freeAboveAgorot,
                  },
                  i.basket.deliveriesPerMonth,
                )
              : undefined,
        };
      }),
    ),
  );
}

export const NOTIFICATION_ICON: Record<NotificationKind, string> = {
  PRICE_INCREASE: "📈",
  PRICE_DROP: "📉",
  CHEAPER_SUPPLIER: "💡",
  SUPPLIER_REPLIED: "💬",
  MATCH_ANSWERED: "🤝",
  NEW_INQUIRY: "📩",
  NEW_MATCH_REQUEST: "🤝",
  MATCH_DECIDED: "✅",
  MONTHLY_REPORT: "🗓️",
  PRICE_APPROVED: "✅",
  PRICE_REJECTED: "⛔",
  ACCOUNT_STATUS: "🏷️",
  OFFER_VIEWED: "👀",
  OFFER_DECIDED: "✅",
  OFFER_CANCELLED: "✖️",
};
