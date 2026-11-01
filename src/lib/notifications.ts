import type { NotificationKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";

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
    const key = `cheaper:${item.customerId}:${supplierId}:${productId}:${newAgorot}`;
    const saving = Math.round((item.paidAgorot - newAgorot) * item.monthlyQuantity);
    const prev = out.get(key);
    if (prev) {
      prev.savingsAgorot = (prev.savingsAgorot ?? 0) + saving;
      continue;
    }
    out.set(key, {
      customerId: item.customerId,
      kind: "CHEAPER_SUPPLIER",
      title: `נמצא מחיר זול יותר ל${productName}`,
      body: `${supplierName} מוכר ב-${price(newAgorot)}, ואתם משלמים היום ${price(item.paidAgorot)}.`,
      href,
      savingsAgorot: saving,
      dedupeKey: key,
    });
  }
  return [...out.values()];
}

/** בודק שינוי מחיר במדרגה הבסיסית של ספק ושולח התראות ללקוחות הרלוונטיים */
export async function notifyPriceChange(change: PriceChange) {
  const [items, zones] = await Promise.all([
    db.basketItem.findMany({
      where: { productId: change.productId },
      select: {
        basketId: true,
        monthlyQuantity: true,
        currentUnitPriceAgorot: true,
        basket: { select: { customerId: true, currentSupplierId: true, customer: { select: { regionId: true } } } },
      },
    }),
    db.deliveryZone.findMany({ where: { supplierId: change.supplierId }, select: { regionId: true } }),
  ]);
  const regions = new Set(zones.map((z) => z.regionId));
  await notify(
    priceChangeNotifications(
      change,
      items.map((i) => ({
        customerId: i.basket.customerId,
        basketId: i.basketId,
        currentSupplierId: i.basket.currentSupplierId,
        paidAgorot: i.currentUnitPriceAgorot,
        monthlyQuantity: i.monthlyQuantity,
        delivers: regions.has(i.basket.customer.regionId),
      })),
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
};
