import type { CardHold } from "@prisma/client";

/**
 * תפיסת מסגרת באשראי בקבלת הצעה.
 *
 * חברת הסליקה נקבעת ב-PAYMENTS_PROVIDER:
 * - "demo": דף תשלום לדוגמה בתוך האתר, בלי חיוב אמיתי. ברירת המחדל בפיתוח (לא בייצור).
 * - "off": בלי תפיסת מסגרת; קבלת הצעה עובדת כמו קודם.
 * - חברת סליקה אמיתית (Cardcom, Tranzila, Grow...) תתחבר כאן דרך דף תשלום מאובטח שלה,
 *   כך שפרטי הכרטיס לא עוברים בשרת שלנו. עד שתחובר, בייצור אין תפיסת מסגרת.
 */
export const HOLD_DAYS = 7;
export const HOLD_VAT_RATE = 0.18;
const DAY = 86_400_000;

export type ProviderName = "demo";

export function paymentsProvider(env: Record<string, string | undefined> = process.env): ProviderName | null {
  const setting = env.PAYMENTS_PROVIDER?.trim().toLowerCase();
  if (setting === "off") return null;
  if (setting === "demo") return "demo";
  // בלי הגדרה: הדגמה רק מחוץ לייצור
  return env.NODE_ENV === "production" ? null : "demo";
}

export const holdsEnabled = () => paymentsProvider() !== null;

/** גובה המסגרת: ההזמנה הראשונה (החודשי חלקי מספר האספקות), כולל מע״מ, מעוגל לשקל */
export function holdAmountAgorot(monthlyTotalAgorot: number, deliveriesPerMonth: number): number {
  const deliveries = Math.max(1, Math.round(deliveriesPerMonth || 1));
  const firstOrder = (monthlyTotalAgorot / deliveries) * (1 + HOLD_VAT_RATE);
  return Math.max(100, Math.ceil(firstOrder / 100) * 100);
}

export const holdExpiry = (authorizedAt: Date) => new Date(authorizedAt.getTime() + HOLD_DAYS * DAY);

export type HoldState = "pending" | "active" | "expired" | "failed" | "released" | "captured";

export function holdState(hold: Pick<CardHold, "status" | "expiresAt">, now = new Date()): HoldState {
  switch (hold.status) {
    case "PENDING":
      return "pending";
    case "FAILED":
      return "failed";
    case "RELEASED":
      return "released";
    case "CAPTURED":
      return "captured";
    case "AUTHORIZED":
      return hold.expiresAt && hold.expiresAt <= now ? "expired" : "active";
  }
}

export const HOLD_STATE_LABEL: Record<HoldState, string> = {
  pending: "ממתינה לאישור",
  active: "מסגרת תפוסה",
  expired: "המסגרת פגה",
  failed: "האישור נכשל",
  released: "המסגרת שוחררה",
  captured: "נגבו דמי אי-הזמנה",
};

/** כתובת דף התשלום שאליו הלקוח עובר כדי לאשר את המסגרת */
export function checkoutUrl(hold: Pick<CardHold, "id" | "provider">): string {
  if (hold.provider === "demo") return `/payments/demo/${hold.id}`;
  throw new Error(`Unknown payments provider ${hold.provider}`);
}

/** שחרור מסגרת אצל חברת הסליקה. בהדגמה אין מה לשחרר */
export async function releaseAtProvider(hold: Pick<CardHold, "provider" | "providerRef">): Promise<boolean> {
  return hold.provider === "demo";
}

/** גביית סכום מתוך המסגרת אצל חברת הסליקה. בהדגמה לא נגבה כסף אמיתי */
export async function captureAtProvider(
  hold: Pick<CardHold, "provider" | "providerRef">,
  amountAgorot: number,
): Promise<boolean> {
  return hold.provider === "demo" && amountAgorot > 0;
}

/** בדיקת מספר כרטיס (אלגוריתם לון), לדף ההדגמה */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** בהדגמה: כרטיס שמסתיים ב-0002 נדחה, כדי שאפשר יהיה לראות גם כישלון */
export const DEMO_DECLINED_SUFFIX = "0002";
