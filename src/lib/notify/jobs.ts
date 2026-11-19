import type { NotificationCategory, NotificationFrequency } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/lib/db";
import { appUrl, deliverQueued, queueEmails, type OutgoingEmail } from "@/lib/email";
import { closeUnanswered, remindUnanswered } from "@/lib/inquiry-deadlines";
import { OPEN_INQUIRY } from "@/lib/inquiries";
import { israelDay, notify, type NewNotification } from "@/lib/notifications";
import { supplierMarket } from "@/lib/supplier/market-load";
import { CATEGORIES, CATEGORY_LABEL, FREQUENCY_LABEL, effectivePref } from "./categories";
import { STALE_PRICE_DAYS } from "./limits";
import { emailFooter, emailSubject, unsubscribeUrl } from "./unsubscribe";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** שעה ויום בשבוע בישראל (0 = ראשון) */
export function israelClock(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")?.value ?? "Sun",
  );
  return { hour, weekday };
}

/** מפתח לשבוע (מתחיל ביום ראשון), לשליחה פעם בשבוע */
export function weekKey(d: Date) {
  const { weekday } = israelClock(d);
  return israelDay(new Date(d.getTime() - weekday * DAY));
}

/** מתי מגיע הסיכום הבא: יומי כל בוקר מ-7, שבועי ביום ראשון מ-7 */
export function digestDue(frequency: NotificationFrequency, lastDigestAt: Date | null, now: Date) {
  const { hour, weekday } = israelClock(now);
  if (hour < 7) return false;
  if (frequency === "DAILY") return !lastDigestAt || israelDay(lastDigestAt) !== israelDay(now);
  if (frequency === "WEEKLY")
    return weekday === 0 && (!lastDigestAt || now.getTime() - lastDigestAt.getTime() > 5 * DAY);
  return false;
}

/** רק פעם בשעה, גם כשהרבה בקשות מפעילות את זה באותו זמן */
async function claim(key: string) {
  const { count } = await db.notificationEvent.createMany({ data: [{ key }], skipDuplicates: true });
  return count > 0;
}

/**
 * המשימות התקופתיות של ההתראות. אין תהליך מתוזמן קבוע: זה רץ אחרי בקשות של משתמשים (פעם בשעה לכל היותר),
 * ואפשר להפעיל גם משירות חיצוני דרך /api/cron/notifications.
 */
export async function runNotificationJobs(now = new Date(), { force = false } = {}) {
  if (!force && !(await claim(`job:${israelDay(now)}:${israelClock(now).hour}`))) return false;
  await deadlines(now);
  await notify([
    ...(await expiringOffers(now)),
    ...(await expiredOffers(now)),
    ...(await staleSupplierPrices(now)),
    ...(await newInterest(now)),
  ]);
  await weeklySupplierChecks(now);
  await digests(now);
  await deliverQueued();
  return true;
}

/** פניות שלא נענו: תזכורת ב-24 שעות וסגירה ב-3 ימים, לכל הספקים (לא רק למי שנכנס) */
async function deadlines(now: Date) {
  await closeUnanswered({}, now);
  const waiting = await db.negotiationRequest.findMany({
    where: { status: { in: OPEN_INQUIRY }, repliedAt: null, outcome: null },
    select: { supplierId: true },
    distinct: ["supplierId"],
  });
  for (const w of waiting) await remindUnanswered(w.supplierId, now);
}

/** למסעדה: הצעה של ספק פגה בעוד פחות מיום ועוד לא החליטה */
async function expiringOffers(now: Date): Promise<NewNotification[]> {
  const soon = { gt: now, lte: new Date(now.getTime() + DAY) };
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { status: "OFFERED", outcome: null, validUntil: soon },
      include: { supplier: { select: { companyName: true } } },
    }),
    db.matchRequest.findMany({
      where: { status: "ANSWERED", outcome: null, validUntil: soon },
      include: { supplier: { select: { companyName: true } } },
    }),
  ]);
  return [
    ...inquiries.map((i) => ({
      customerId: i.customerId,
      aboutSupplierId: i.supplierId,
      kind: "OFFER_EXPIRING" as const,
      title: `ההצעה של ${i.supplier.companyName} פגה מחר`,
      body: "אם ההצעה מתאימה לכם, קבלו אותה לפני שהתוקף נגמר.",
      href: `/customer/inquiries/${i.id}`,
      dedupeKey: `expiring:inquiry:${i.id}`,
    })),
    ...matches.map((m) => ({
      customerId: m.customerId,
      aboutSupplierId: m.supplierId,
      kind: "OFFER_EXPIRING" as const,
      title: `התשובה של ${m.supplier.companyName} לבקשת ההשוואה פגה מחר`,
      body: "אשרו את המחירים שמתאימים לכם לפני שהתוקף נגמר.",
      href: `/customer/matches/${m.id}`,
      dedupeKey: `expiring:match:${m.id}`,
    })),
  ];
}

/** לספק: ההצעה שלו פגה והלקוח לא החליט */
async function expiredOffers(now: Date): Promise<NewNotification[]> {
  const past = { lte: now, gt: new Date(now.getTime() - 7 * DAY) };
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { status: "OFFERED", outcome: null, validUntil: past },
      include: { customer: { select: { businessName: true } } },
    }),
    db.matchRequest.findMany({
      where: { status: "ANSWERED", outcome: null, validUntil: past },
      include: { customer: { select: { businessName: true } } },
    }),
  ]);
  return [
    ...inquiries.map((i) => ({
      supplierId: i.supplierId,
      kind: "OFFER_EXPIRED" as const,
      title: `ההצעה שלכם ל${i.customer.businessName} פגה`,
      body: "הלקוח לא החליט בזמן. אפשר לשלוח לו הצעה מעודכנת.",
      href: `/supplier/inquiries/${i.id}`,
      dedupeKey: `expired:inquiry:${i.id}`,
    })),
    ...matches.map((m) => ({
      supplierId: m.supplierId,
      kind: "OFFER_EXPIRED" as const,
      title: `התשובה שלכם לבקשת ההשוואה של ${m.customer.businessName} פגה`,
      body: "הלקוח לא החליט בזמן. אפשר לשלוח תשובה מעודכנת.",
      href: `/supplier/matches/${m.id}`,
      dedupeKey: `expired:match:${m.id}`,
    })),
  ];
}

/** למסעדה: הספק הנוכחי שלה לא עדכן את המחירים של המוצרים שלה יותר מחודש (פעם בחודש) */
async function staleSupplierPrices(now: Date): Promise<NewNotification[]> {
  const rows = await db.$queryRaw<{ customerId: string; supplierId: string; companyName: string; newest: Date }[]>`
    SELECT b."customerId", b."currentSupplierId" AS "supplierId", s."companyName", MAX(p."createdAt") AS newest
    FROM "Basket" b
    JOIN "BasketItem" bi ON bi."basketId" = b.id
    JOIN "SupplierOffer" o ON o."supplierId" = b."currentSupplierId" AND o."productId" = bi."productId" AND o."archivedAt" IS NULL
    JOIN "OfferPrice" p ON p."offerId" = o.id AND p.status = 'LIVE'
    JOIN "Supplier" s ON s.id = b."currentSupplierId"
    WHERE b."currentSupplierId" IS NOT NULL
    GROUP BY 1, 2, 3`;
  const month = israelDay(now).slice(0, 7);
  return rows
    .filter((r) => now.getTime() - new Date(r.newest).getTime() > STALE_PRICE_DAYS * DAY)
    .map((r) => ({
      customerId: r.customerId,
      aboutSupplierId: r.supplierId,
      kind: "STALE_SUPPLIER_PRICES" as const,
      title: `${r.companyName} לא עדכן מחירים יותר מ-${STALE_PRICE_DAYS} יום`,
      body: "המחירים במערכת אולי לא תואמים למה שתשלמו. כדאי לוודא מול הספק, או לבדוק ספקים אחרים.",
      href: `/customer/suppliers`,
      dedupeKey: `stale:${r.customerId}:${r.supplierId}:${month}`,
    }));
}

/** לספק: עסקים שראו אותו בהשוואה בפעם הראשונה. התראה אחת ליום עם מספר העסקים, בלי שמות */
async function newInterest(now: Date): Promise<NewNotification[]> {
  const since = new Date(now.getTime() - 2 * DAY);
  const firsts = await db.$queryRaw<{ supplierId: string; customerId: string; first: Date }[]>`
    SELECT "supplierId", "customerId", MIN(day) AS first FROM "SupplierView" GROUP BY 1, 2
    HAVING MIN(day) >= ${since}`;
  return firsts.map((f) => ({
    supplierId: f.supplierId,
    kind: "NEW_INTEREST" as const,
    title: "עסק חדש ראה את המחירים שלכם בהשוואה",
    body: "כדאי לוודא שהמחירים מעודכנים, כדי שתבלטו בהשוואות הבאות.",
    href: "/supplier",
    dedupeKey: `interest:${f.supplierId}:${f.customerId}`,
    group: {
      key: `interest:${f.supplierId}:${israelDay(now)}`,
      title: (count: number) => `${count} עסקים חדשים ראו את המחירים שלכם בהשוואות`,
    },
  }));
}

/** לספק, פעם בשבוע: מוצרים יקרים מהשוק, ומחירים או אזורים שצריך לעדכן */
async function weeklySupplierChecks(now: Date) {
  const week = weekKey(now);
  const suppliers = await db.supplier.findMany({
    where: { status: "APPROVED" },
    select: { id: true, _count: { select: { deliveryAreas: true, deliveryZones: true } } },
  });
  const done = new Set(
    (
      await db.notification.findMany({
        where: { dedupeKey: { in: suppliers.flatMap((s) => [`expensive:${s.id}:${week}`, `update:${s.id}:${week}`]) } },
        select: { dedupeKey: true },
      })
    ).map((n) => n.dedupeKey),
  );
  const staleRows = await db.$queryRaw<{ supplierId: string; stale: bigint }[]>`
    SELECT o."supplierId", COUNT(*) AS stale
    FROM "SupplierOffer" o
    JOIN (SELECT "offerId", MAX("createdAt") AS newest FROM "OfferPrice" WHERE status = 'LIVE' GROUP BY 1) m ON m."offerId" = o.id
    WHERE o.available AND o."archivedAt" IS NULL AND m.newest < ${new Date(now.getTime() - STALE_PRICE_DAYS * DAY)}
    GROUP BY 1`;
  const stale = new Map(staleRows.map((r) => [r.supplierId, Number(r.stale)]));
  const notes: NewNotification[] = [];
  for (const s of suppliers) {
    if (!done.has(`expensive:${s.id}:${week}`)) {
      const high = (await supplierMarket(s.id, now)).filter((r) => r.position?.band === "HIGH").length;
      if (high > 0)
        notes.push({
          supplierId: s.id,
          kind: "EXPENSIVE_PRODUCTS",
          title: high === 1 ? "מוצר אחד שלכם יקר ביחס לשוק" : `${high} מוצרים שלכם יקרים ביחס לשוק`,
          body: "המחיר גבוה ב-10% ומעלה מהספק הזול. לקוחות רואים את זה בהשוואה.",
          href: "/supplier/market",
          dedupeKey: `expensive:${s.id}:${week}`,
        });
    }
    if (!done.has(`update:${s.id}:${week}`)) {
      const count = stale.get(s.id) ?? 0;
      const noAreas = s._count.deliveryAreas + s._count.deliveryZones === 0;
      if (count > 0 || noAreas)
        notes.push({
          supplierId: s.id,
          kind: "UPDATE_NEEDED",
          title: count > 0 ? `${count} מחירים לא עודכנו יותר מ-${STALE_PRICE_DAYS} יום` : "עוד לא סימנתם אזורי חלוקה",
          body:
            count > 0
              ? `לקוחות רואים אותם כ"מחירון" ולא כמחיר מעודכן.${noAreas ? " וגם עוד לא סימנתם אזורי חלוקה." : ""}`
              : "בלי אזורי חלוקה לקוחות לא רואים אתכם בהשוואות.",
          href: count > 0 ? "/supplier" : "/supplier/areas",
          dedupeKey: `update:${s.id}:${week}`,
        });
    }
  }
  await notify(notes);
}

/** סיכום יומי או שבועי באימייל, לכל משתמש לפי הבחירה שלו בכל קבוצה */
async function digests(now: Date) {
  const users = await db.user.findMany({
    where: { role: { in: ["CUSTOMER", "SUPPLIER"] } },
    select: {
      id: true,
      email: true,
      role: true,
      customerId: true,
      supplierId: true,
      marketingConsentAt: true,
      notificationPreferences: true,
    },
  });
  const emails: OutgoingEmail[] = [];
  for (const u of users) {
    const org = u.role === "CUSTOMER" ? "CUSTOMER" : "SUPPLIER";
    const orgWhere = u.customerId ? { customerId: u.customerId } : u.supplierId ? { supplierId: u.supplierId } : null;
    if (!orgWhere) continue;
    for (const category of CATEGORIES) {
      const saved = u.notificationPreferences.find((p) => p.category === category);
      const pref = effectivePref(category, saved);
      if (pref.email !== "DAILY" && pref.email !== "WEEKLY") continue;
      const last = saved?.lastDigestAt ?? null;
      if (!digestDue(pref.email, last, now)) continue;
      // חוק הספאם: סיכום פרסומי רק למי שנתן הסכמה מפורשת
      if (category === "MARKETING" && !u.marketingConsentAt) continue;
      const period = pref.email === "DAILY" ? DAY : 7 * DAY;
      const from = new Date(Math.max(last?.getTime() ?? 0, now.getTime() - period));
      const items = await db.notification.findMany({
        where: { ...orgWhere, category, createdAt: { gt: from } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      await markDigest(u.id, category, pref.inApp, pref.email, now);
      if (items.length === 0) continue;
      const area = org === "CUSTOMER" ? "/customer" : "/supplier";
      const label = CATEGORY_LABEL[org][category].title;
      const unsubscribe = category === "CRITICAL" ? undefined : unsubscribeUrl(u.id, category);
      emails.push({
        userId: u.id,
        to: u.email,
        kind: pref.email,
        unsubscribeUrl: unsubscribe,
        subject: emailSubject(category, `${FREQUENCY_LABEL[pref.email]}: ${label} (${items.length})`),
        text: [
          `${label}, ${pref.email === "DAILY" ? "מאתמול" : "מהשבוע האחרון"}:`,
          "",
          ...items.map((n) => `• ${n.title}${n.body ? `\n  ${n.body}` : ""}`),
          "",
          `לכל ההתראות: ${appUrl(`${area}/notifications`)}`,
          "",
          ...emailFooter({
            org,
            category,
            settingsUrl: appUrl(`${area}/notifications/settings`),
            unsubscribeUrl: unsubscribe,
          }),
        ].join("\n"),
      });
    }
  }
  await queueEmails(emails);
}

async function markDigest(
  userId: string,
  category: NotificationCategory,
  inApp: boolean,
  email: NotificationFrequency,
  now: Date,
) {
  await db.notificationPreference.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, inApp, email, lastDigestAt: now },
    update: { lastDigestAt: now },
  });
}

/** מפעיל את המשימות אחרי שהדף כבר נשלח למשתמש, כדי שלא יאט אותו */
export function kickNotificationJobs() {
  try {
    after(() => runNotificationJobs().catch((e) => console.error("notification jobs failed", e)));
  } catch {
    // מחוץ לבקשה (סקריפטים ובדיקות): לא מפעילים
  }
}
