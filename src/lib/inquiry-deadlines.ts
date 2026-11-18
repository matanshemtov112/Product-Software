import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { isQuoteSnapshot, OPEN_INQUIRY } from "@/lib/inquiries";
import { OPEN_MATCH } from "@/lib/matches";
import { dateTime, LOCK_DAYS, LOCK_HOURS, lockedUntil, REMINDER_HOURS } from "@/lib/quote-validity";

const HOUR = 3_600_000;

/**
 * פניות ובקשות השוואה שהספק לא ענה עליהן תוך 3 ימים נסגרות כ"הספק לא ענה", והלקוח והספק מקבלים התראה.
 * אין תהליך מתוזמן: זה רץ כשלקוח או ספק נכנסים, ולפני שליחת פנייה חדשה.
 */
export async function closeUnanswered(scope: { customerId?: string; supplierId?: string }, now = new Date()) {
  const before = new Date(now.getTime() - LOCK_HOURS * HOUR);
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { ...scope, status: { in: OPEN_INQUIRY }, repliedAt: null, outcome: null, createdAt: { lte: before } },
      include: { customer: { select: { businessName: true } }, supplier: { select: { companyName: true } } },
    }),
    db.matchRequest.findMany({
      where: { ...scope, status: { in: OPEN_MATCH }, answeredAt: null, outcome: null, createdAt: { lte: before } },
      include: { customer: { select: { businessName: true } }, supplier: { select: { companyName: true } } },
    }),
  ]);
  const closed = { outcome: "NO_REPLY" as const, outcomeAt: now, status: "CLOSED" as const };
  const notes = [];
  for (const i of inquiries) {
    const { count } = await db.negotiationRequest.updateMany({
      where: { id: i.id, repliedAt: null, outcome: null },
      data: closed,
    });
    if (!count) continue;
    notes.push(
      {
        customerId: i.customerId,
        kind: "NO_REPLY" as const,
        title: `${i.supplier.companyName} לא ענו לפנייה שלכם תוך ${LOCK_DAYS} ימים`,
        body: "הפנייה נסגרה. אפשר לשלוח פנייה חדשה עם המחירים של היום, או לפנות לספק אחר.",
        href: `/customer/inquiries/${i.id}`,
        dedupeKey: `no-reply:inquiry:${i.id}:customer`,
      },
      {
        supplierId: i.supplierId,
        kind: "NO_REPLY" as const,
        title: `הפנייה מ${i.customer.businessName} נסגרה כי לא עניתם תוך ${LOCK_DAYS} ימים`,
        href: `/supplier/inquiries/${i.id}`,
        dedupeKey: `no-reply:inquiry:${i.id}:supplier`,
      },
    );
  }
  for (const m of matches) {
    const { count } = await db.matchRequest.updateMany({
      where: { id: m.id, answeredAt: null, outcome: null },
      data: closed,
    });
    if (!count) continue;
    notes.push(
      {
        customerId: m.customerId,
        kind: "NO_REPLY" as const,
        title: `${m.supplier.companyName} לא ענו לבקשת ההשוואה תוך ${LOCK_DAYS} ימים`,
        body: "הבקשה נסגרה. אפשר לשלוח בקשה חדשה עם המחירים של היום, או לעבור לספק שמצאתם.",
        href: `/customer/matches/${m.id}`,
        dedupeKey: `no-reply:match:${m.id}:customer`,
      },
      {
        supplierId: m.supplierId,
        kind: "NO_REPLY" as const,
        title: `בקשת ההשוואה מ${m.customer.businessName} נסגרה כי לא עניתם תוך ${LOCK_DAYS} ימים`,
        href: `/supplier/matches/${m.id}`,
        dedupeKey: `no-reply:match:${m.id}:supplier`,
      },
    );
  }
  await notify(notes);
  return inquiries.length + matches.length;
}

/** תזכורת לספק על פניות שמחכות לתשובה יותר מ-24 שעות (פעם אחת לכל פנייה) */
export async function remindUnanswered(supplierId: string, now = new Date()) {
  const window = {
    lte: new Date(now.getTime() - REMINDER_HOURS * HOUR),
    gt: new Date(now.getTime() - LOCK_HOURS * HOUR),
  };
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { supplierId, status: { in: OPEN_INQUIRY }, repliedAt: null, outcome: null, createdAt: window },
      include: { customer: { select: { businessName: true } } },
    }),
    db.matchRequest.findMany({
      where: { supplierId, status: { in: OPEN_MATCH }, answeredAt: null, outcome: null, createdAt: window },
      include: { customer: { select: { businessName: true } } },
    }),
  ]);
  const body = (sentAt: Date) =>
    `המחירים בפנייה נעולים ללקוח עד ${dateTime(lockedUntil(sentAt))}. בלי תשובה עד אז הפנייה תיסגר, וזה ייספר בזמן התגובה שלכם.`;
  await notify([
    ...inquiries.map((i) => ({
      supplierId,
      kind: "REPLY_REMINDER" as const,
      title: `תזכורת: ${i.customer.businessName} מחכים לתשובה שלכם`,
      body: body(i.createdAt),
      href: `/supplier/inquiries/${i.id}`,
      dedupeKey: `reminder:inquiry:${i.id}`,
    })),
    ...matches.map((m) => ({
      supplierId,
      kind: "REPLY_REMINDER" as const,
      title: `תזכורת: ${m.customer.businessName} מחכים לתשובה לבקשת ההשוואה`,
      body: body(m.createdAt),
      href: `/supplier/matches/${m.id}`,
      dedupeKey: `reminder:match:${m.id}`,
    })),
  ]);
}

export interface ResponseStats {
  /** פניות ובקשות השוואה ב-90 הימים האחרונים שכבר אפשר לשפוט (נענו או שעברו 3 ימים) */
  total: number;
  /** כמה מהן נענו תוך 3 ימים, 0 עד 1 */
  rate: number;
  /** חציון שעות עד תשובה, למי שענה */
  medianHours: number | null;
}

/** זמן התגובה של ספקים: כמה מהפניות הם עונים ותוך כמה זמן. מוצג ללקוחות ונספר בדירוג */
export async function responseStats(supplierIds: string[], now = new Date()): Promise<Map<string, ResponseStats>> {
  const since = new Date(now.getTime() - 90 * 24 * HOUR);
  const judged = new Date(now.getTime() - LOCK_HOURS * HOUR);
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { supplierId: { in: supplierIds }, createdAt: { gte: since } },
      select: { supplierId: true, createdAt: true, repliedAt: true, outcome: true, cancelledBy: true },
    }),
    db.matchRequest.findMany({
      where: { supplierId: { in: supplierIds }, createdAt: { gte: since } },
      select: { supplierId: true, createdAt: true, answeredAt: true, outcome: true, cancelledBy: true },
    }),
  ]);
  const rows = [...inquiries.map((i) => ({ ...i, answeredAt: i.repliedAt })), ...matches.map((m) => ({ ...m }))];
  const by = new Map<string, { total: number; inTime: number; hours: number[] }>();
  for (const r of rows) {
    // לקוח שביטל לפני תשובה לא נספר לחובת הספק
    if (!r.answeredAt && r.outcome === "CANCELLED" && r.cancelledBy === "CUSTOMER") continue;
    if (!r.answeredAt && r.outcome !== "NO_REPLY" && r.createdAt > judged) continue;
    const s = by.get(r.supplierId) ?? { total: 0, inTime: 0, hours: [] };
    s.total++;
    if (r.answeredAt) {
      const h = (r.answeredAt.getTime() - r.createdAt.getTime()) / HOUR;
      if (h <= LOCK_HOURS) s.inTime++;
      s.hours.push(h);
    }
    by.set(r.supplierId, s);
  }
  const out = new Map<string, ResponseStats>();
  for (const [id, s] of by) {
    const sorted = s.hours.sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
    out.set(id, { total: s.total, rate: s.total ? s.inTime / s.total : 0, medianHours: median });
  }
  return out;
}

/** "עונה בדרך כלל תוך 5 שעות · ענה ל-90% מהפניות" (רק כשיש לפחות 3 פניות) */
export function responseText(s: ResponseStats | undefined): string | null {
  if (!s || s.total < 3) return null;
  const pct = `ענה ל-${Math.round(s.rate * 100)}% מהפניות תוך ${LOCK_DAYS} ימים`;
  if (s.medianHours === null) return pct;
  const t =
    s.medianHours < 1
      ? "פחות משעה"
      : s.medianHours < 48
        ? `${Math.round(s.medianHours)} שעות`
        : `${Math.round(s.medianHours / 24)} ימים`;
  return `עונה בדרך כלל תוך ${t} · ${pct}`;
}

/**
 * פניות פתוחות של ספק שכוללות מוצר, ושהמחירים בהן עוד נעולים: כשהספק עורך את המחיר
 * הוא רואה שהמחיר החדש לא יחול עליהן.
 */
export async function lockedInquiriesWith(supplierId: string, productName: string, now = new Date()) {
  const open = await db.negotiationRequest.findMany({
    where: { supplierId, outcome: null, createdAt: { gt: new Date(now.getTime() - LOCK_HOURS * HOUR) } },
    select: { createdAt: true, quote: true },
  });
  const locked = open.filter((i) =>
    isQuoteSnapshot(i.quote) ? i.quote.lines.some((l) => l.productName === productName) : false,
  );
  const last = locked.reduce<Date | null>((d, i) => (!d || i.createdAt > d ? i.createdAt : d), null);
  return { count: locked.length, until: last ? lockedUntil(last) : null };
}
