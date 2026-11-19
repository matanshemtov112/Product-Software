import { createHmac, timingSafeEqual } from "node:crypto";
import type { NotificationCategory } from "@prisma/client";
import { appUrl } from "@/lib/email";
import { CATEGORIES, CATEGORY_LABEL } from "./categories";

/**
 * קישור הסרה מרשימת התפוצה, שעובד בלי להתחבר (חוק התקשורת, סעיף 30א).
 * הקישור חתום, כך שאי אפשר להסיר מישהו אחר על ידי ניחוש.
 */
function secret() {
  return process.env.SESSION_SECRET || "dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(`unsubscribe:${payload}`).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(userId: string, category: NotificationCategory) {
  const payload = `${userId}.${category}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readUnsubscribeToken(token: string): { userId: string; category: NotificationCategory } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return null;
  const [userId, category] = payload.split(".");
  if (!userId || !CATEGORIES.includes(category as NotificationCategory) || category === "CRITICAL") return null;
  return { userId, category: category as NotificationCategory };
}

export function unsubscribeUrl(userId: string, category: NotificationCategory) {
  return appUrl(`/unsubscribe?t=${unsubscribeToken(userId, category)}`);
}

/** פרטי השולח שחייבים להופיע בדבר פרסומת: שם, כתובת ודרך ליצור קשר */
export function senderDetails() {
  const name = process.env.SENDER_NAME || "השוואת ספקים";
  const address = process.env.SENDER_ADDRESS || "";
  const contact = process.env.SENDER_CONTACT || process.env.EMAIL_FROM || "";
  return [name, address, contact].filter(Boolean).join(" · ");
}

/** בדבר פרסומת הכותרת חייבת להתחיל במילה "פרסומת" */
export function emailSubject(category: NotificationCategory, title: string) {
  return category === "MARKETING" ? `פרסומת: ${title}` : title;
}

/** שורות הסיום של כל אימייל: למה הוא נשלח, קישור להסרה, ובפרסומת גם פרטי השולח */
export function emailFooter(opts: {
  org: "CUSTOMER" | "SUPPLIER";
  category: NotificationCategory;
  settingsUrl: string;
  unsubscribeUrl?: string;
}) {
  const lines = [
    `קיבלתם את ההודעה כי בחרתם לקבל "${CATEGORY_LABEL[opts.org][opts.category].title}" באימייל.`,
    `לשינוי ההגדרות: ${opts.settingsUrl}`,
  ];
  if (opts.unsubscribeUrl) lines.push(`להסרה מרשימת התפוצה בלחיצה אחת: ${opts.unsubscribeUrl}`);
  if (opts.category === "MARKETING") lines.push("", `השולח: ${senderDetails()}`);
  return lines;
}
