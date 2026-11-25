/** חשבונית עד גיל זה נחשבת עדכנית, ומחיריה משמשים כמחיר הנוכחי של הלקוח */
export const FRESH_DAYS = 90;
/** חשבונית ישנה מזה לא משמשת למחירים בכלל, רק לרשימת המוצרים והכמויות */
export const MAX_DAYS = 365;

export type InvoiceAge =
  | { kind: "unknown" }
  | { kind: "future" }
  | { kind: "fresh" | "old" | "too_old"; days: number; months: number };

const DAY = 24 * 60 * 60 * 1000;

/** תאריך YYYY-MM-DD תקין (כולל בדיקה שהיום קיים בחודש) */
function isoDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : null;
}

/** "היום" כ-YYYY-MM-DD לפי שעון ישראל */
export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
}

/**
 * כמה ישנה החשבונית ביחס להיום. יום אחד קדימה מותר (הפרשי שעון), יותר מזה הוא כנראה טעות בקריאה.
 */
export function invoiceAge(date: string | null | undefined, today: string = todayInIsrael()): InvoiceAge {
  const t = date ? isoDay(date) : null;
  const now = isoDay(today);
  if (t === null || now === null) return { kind: "unknown" };
  const days = Math.round((now - t) / DAY);
  if (days < -1) return { kind: "future" };
  const age = Math.max(0, days);
  const months = Math.round(age / 30.4);
  return { kind: age <= FRESH_DAYS ? "fresh" : age <= MAX_DAYS ? "old" : "too_old", days: age, months };
}

/**
 * מנרמל תאריך כפי שנקרא מהחשבונית ל-YYYY-MM-DD. בחשבוניות בישראל היום בא קודם (DD/MM/YYYY).
 */
export function normalizeInvoiceDate(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (isoDay(value) !== null) return value;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(value);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isoDay(iso) !== null ? iso : null;
}

/** "לפני 5 ימים" / "לפני כ-4 חודשים" / "לפני יותר משנה" */
export function ageText(age: InvoiceAge): string {
  if (age.kind === "unknown" || age.kind === "future") return "";
  if (age.days === 0) return "מהיום";
  if (age.days === 1) return "מאתמול";
  if (age.days < 45) return `לפני ${age.days} ימים`;
  if (age.kind === "too_old") return age.days >= 730 ? `לפני כ-${Math.floor(age.days / 365)} שנים` : "לפני יותר משנה";
  return `לפני כ-${age.months} חודשים`;
}
