import { db } from "@/lib/db";

/**
 * שליחת אימייל דרך Resend (https://resend.com), כשמוגדרים RESEND_API_KEY ו-EMAIL_FROM.
 * כל הודעה נרשמת קודם בטבלת EmailMessage, כך שהאדמין רואה מה נשלח ומה נכשל.
 * בלי הגדרה ההודעה נרשמת כ"לא נשלחה" (SKIPPED) והמערכת ממשיכה לעבוד.
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** כתובת האתר לקישורים באימייל */
export function appUrl(path = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

export interface OutgoingEmail {
  userId?: string;
  to: string;
  subject: string;
  text: string;
  /** INSTANT / DAILY / WEEKLY */
  kind: string;
}

export async function queueEmails(emails: OutgoingEmail[]) {
  if (emails.length === 0) return;
  await db.emailMessage.createMany({ data: emails });
}

async function sendOne(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** שולח את ההודעות שממתינות. נקרא אחרי שהתגובה למשתמש כבר נשלחה, ובמשימות התקופתיות */
export async function deliverQueued(limit = 50) {
  const queued = await db.emailMessage.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (queued.length === 0) return;
  if (!emailConfigured()) {
    await db.emailMessage.updateMany({
      where: { id: { in: queued.map((m) => m.id) } },
      data: { status: "SKIPPED", error: "שירות האימייל עוד לא הוגדר" },
    });
    return;
  }
  for (const m of queued) {
    try {
      await sendOne(m.to, m.subject, m.text);
      await db.emailMessage.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date() } });
    } catch (e) {
      await db.emailMessage.update({
        where: { id: m.id },
        data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
      });
    }
  }
}
