import type { Notification, NotificationKind, Prisma } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/lib/db";
import { effectiveCost, type EffectiveCost } from "@/lib/customer/effective-cost";
import { priceAt } from "@/lib/customer/monthly-report";
import { appUrl, deliverQueued, queueEmails, type OutgoingEmail } from "@/lib/email";
import { shekels } from "@/lib/format";
import { servesCustomer } from "@/lib/geo";
import { CATEGORY_LABEL, CATEGORY_OF, effectivePref } from "@/lib/notify/categories";

export interface NewNotification {
  customerId?: string;
  supplierId?: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href: string;
  savingsAgorot?: number;
  dedupeKey?: string;
  /** הספק שההתראה עליו (למסעדה): ספק שהמסעדה השתיקה או חסמה לא מייצר התראות */
  aboutSupplierId?: string;
  /**
   * התראה מרוכזת: כל האירועים עם אותו מפתח מצטרפים להתראה אחת (המונה והחיסכון מצטברים).
   * dedupeKey מזהה את האירוע עצמו, כדי שלא ייספר פעמיים.
   */
  group?: { key: string; title: (count: number, savingsAgorot: number) => string; href?: string };
}

/** ההתראה המרוכזת של היום להזדמנויות לחיסכון של מסעדה */
export function savingsGroup(customerId: string, now = new Date()): NonNullable<NewNotification["group"]> {
  return {
    key: `savings:${customerId}:${israelDay(now)}`,
    href: "/customer",
    title: (count, savings) =>
      `נמצאו ${count} הזדמנויות לחיסכון היום${savings > 0 ? ` · עד ${shekels(savings)} בחודש` : ""}`,
  };
}

/** היום בישראל, YYYY-MM-DD */
export function israelDay(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

const toRow = (item: NewNotification) => {
  const { group, ...n } = item;
  void group;
  return { ...n, category: CATEGORY_OF[n.kind] } as Prisma.NotificationCreateManyInput;
};

/** מסנן התראות על ספקים שהמסעדה חסמה (הכול) או השתיקה (הכול חוץ מתשובות להצעות והתראות חשובות) */
async function withoutBlocked(items: NewNotification[]) {
  const about = items.filter((i) => i.customerId && i.aboutSupplierId);
  if (about.length === 0) return items;
  const blocks = await db.supplierBlock.findMany({
    where: { OR: about.map((i) => ({ customerId: i.customerId!, supplierId: i.aboutSupplierId! })) },
  });
  if (blocks.length === 0) return items;
  const mode = new Map(blocks.map((b) => [`${b.customerId}:${b.supplierId}`, b.mode]));
  return items.filter((i) => {
    const m = i.customerId && i.aboutSupplierId ? mode.get(`${i.customerId}:${i.aboutSupplierId}`) : undefined;
    if (!m) return true;
    if (m === "BLOCK") return false;
    return ["OFFERS", "CRITICAL"].includes(CATEGORY_OF[i.kind]);
  });
}

/** מוסיף אירוע להתראה המרוכזת; מחזיר את ההתראה רק כשנוצרה עכשיו (בשביל אימייל מיידי) */
async function addToGroup(item: NewNotification): Promise<Notification | null> {
  const group = item.group!;
  if (item.dedupeKey) {
    const fresh = await db.notificationEvent.createMany({ data: [{ key: item.dedupeKey }], skipDuplicates: true });
    if (fresh.count === 0) return null;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await db.notification.findUnique({ where: { groupKey: group.key } });
    if (existing) {
      const count = existing.groupCount + 1;
      const savings = (existing.savingsAgorot ?? 0) + (item.savingsAgorot ?? 0);
      await db.notification.update({
        where: { id: existing.id },
        data: {
          groupCount: count,
          savingsAgorot: savings || null,
          title: group.title(count, savings),
          body: item.body ?? null,
          href: group.href ?? item.href,
          read: false,
          createdAt: new Date(),
        },
      });
      return null;
    }
    try {
      return await db.notification.create({
        data: {
          ...toRow({ ...item, dedupeKey: undefined }),
          groupKey: group.key,
        } as Prisma.NotificationUncheckedCreateInput,
      });
    } catch {
      // שני אירועים באותו רגע: השני מתווסף להתראה שהראשון יצר
    }
  }
  return null;
}

/** אימייל מיידי לכל משתמש בעסק שבחר "מיד" לקבוצה של ההתראה */
async function queueInstantEmails(created: Notification[]) {
  if (created.length === 0) return;
  const customerIds = [...new Set(created.flatMap((n) => (n.customerId ? [n.customerId] : [])))];
  const supplierIds = [...new Set(created.flatMap((n) => (n.supplierId ? [n.supplierId] : [])))];
  const users = await db.user.findMany({
    where: { OR: [{ customerId: { in: customerIds } }, { supplierId: { in: supplierIds } }] },
    select: { id: true, email: true, customerId: true, supplierId: true, notificationPreferences: true },
  });
  const emails: OutgoingEmail[] = [];
  for (const n of created) {
    const org = n.customerId ? "CUSTOMER" : "SUPPLIER";
    const area = org === "CUSTOMER" ? "/customer" : "/supplier";
    for (const u of users) {
      if (n.customerId ? u.customerId !== n.customerId : u.supplierId !== n.supplierId) continue;
      const pref = effectivePref(
        n.category,
        u.notificationPreferences.find((p) => p.category === n.category),
      );
      if (pref.email !== "INSTANT") continue;
      emails.push({
        userId: u.id,
        to: u.email,
        subject: n.title,
        kind: "INSTANT",
        text: [
          n.title,
          n.body,
          n.savingsAgorot ? `חיסכון של עד ${shekels(n.savingsAgorot)} בחודש` : null,
          `לפרטים: ${appUrl(n.href)}`,
          "",
          `קיבלתם את ההודעה כי בחרתם לקבל "${CATEGORY_LABEL[org][n.category].title}" באימייל.`,
          `לשינוי: ${appUrl(`${area}/notifications/settings`)}`,
        ]
          .filter((l) => l !== null && l !== undefined)
          .join("\n"),
      });
    }
  }
  await queueEmails(emails);
  if (emails.length) {
    await db.notification.updateMany({
      where: { id: { in: created.map((n) => n.id) } },
      data: { emailedAt: new Date() },
    });
  }
}

/** שולח את האימיילים אחרי שהתגובה למשתמש כבר יצאה; מחוץ לבקשה (סקריפטים) שולח מיד */
export function scheduleEmailDelivery() {
  try {
    after(() => deliverQueued());
  } catch {
    void deliverQueued().catch((e) => console.error("email delivery failed", e));
  }
}

/**
 * שומר התראות. התראה עם אותו dedupeKey נשמרת פעם אחת בלבד, התראות מרוכזות מצטרפות להתראה אחת,
 * ועל ספק שהמסעדה חסמה או השתיקה לא נשלחות התראות. אחר כך אימייל מיידי למי שבחר בזה.
 */
export async function notify(items: NewNotification[]) {
  if (items.length === 0) return;
  const allowed = await withoutBlocked(items);
  const created: Notification[] = [];
  const plain = allowed.filter((i) => !i.group);
  if (plain.length) {
    created.push(...(await db.notification.createManyAndReturn({ data: plain.map(toRow), skipDuplicates: true })));
  }
  for (const item of allowed.filter((i) => i.group)) {
    const n = await addToGroup(item);
    if (n) created.push(n);
  }
  try {
    await queueInstantEmails(created);
    scheduleEmailDelivery();
  } catch (e) {
    console.error("instant email failed", e);
  }
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
/** ירידת מחיר של 5% ומעלה נחשבת משמעותית */
export const SIGNIFICANT_DROP = 0.05;

export function priceChangeNotifications(change: PriceChange, items: WatchedItem[]): NewNotification[] {
  const { supplierId, supplierName, productId, productName, unitLabel, oldAgorot, newAgorot } = change;
  const price = (a: number) => `${shekels(a, 2)} ל${unitLabel}`;
  const out = new Map<string, NewNotification>();
  for (const item of items) {
    const href = `/customer/baskets/${item.basketId}`;
    if (item.currentSupplierId === supplierId) {
      if (oldAgorot === null || oldAgorot === newAgorot) continue;
      const up = newAgorot > oldAgorot;
      // עלייה תמיד; ירידה רק כשהיא משמעותית, כדי לא להציף
      if (!up && (oldAgorot - newAgorot) / oldAgorot < SIGNIFICANT_DROP) continue;
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
  const priceNow = new Date();
  const baseTier = supplier.priceTiers[0]?.id;
  const prices = new Map<string, number>();
  for (const o of supplier.offers) {
    const points = o.prices
      .filter((p) => p.tierId === baseTier)
      .map((p) => ({ ...p, supplierId: change.supplierId, productId: o.productId }));
    const price = priceAt(points, priceNow);
    // כמה אריזות לאותו מוצר: המחיר הזול לק״ג
    if (price !== null && price < (prices.get(o.productId) ?? Infinity)) prices.set(o.productId, price);
  }
  prices.set(change.productId, Math.min(prices.get(change.productId) ?? Infinity, change.newAgorot));
  const zones = new Map(supplier.deliveryZones.map((z) => [z.regionId, z]));
  const coverage = { areas: supplier.deliveryAreas, regionIds: [...zones.keys()] };

  const now = new Date();
  const list = priceChangeNotifications(
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
  );
  // הזדמנויות לחיסכון מרוכזות בהתראה אחת ליום; שינויי מחיר של אותו ספק מרוכזים בהתראה אחת ליום
  await notify(
    list.map((n) => ({
      ...n,
      aboutSupplierId: change.supplierId,
      group:
        n.kind === "CHEAPER_SUPPLIER"
          ? savingsGroup(n.customerId!, now)
          : {
              key: `prices:${n.customerId}:${change.supplierId}:${israelDay(now)}`,
              title: (count: number) => `${change.supplierName} שינה ${count} מחירים של מוצרים שאתם קונים`,
            },
    })),
  );
}

export const NOTIFICATION_ICON: Record<NotificationKind, string> = {
  INVOICE_SAVINGS: "🧾",
  STALE_SUPPLIER_PRICES: "🕰️",
  OFFER_EXPIRING: "⏳",
  OFFER_EXPIRED: "⌛",
  NEW_INTEREST: "👋",
  EXPENSIVE_PRODUCTS: "🏷️",
  UPDATE_NEEDED: "✏️",
  NEW_DEAL: "🎁",
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
  PRICE_VIOLATION: "⚠️",
  VERIFICATION: "✅",
  REPLY_REMINDER: "⏰",
  NO_REPLY: "⌛",
};
