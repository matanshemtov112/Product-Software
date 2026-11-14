/** שינוי מחיר שגדול מזה (ביחס למחיר הנוכחי) ממתין לאישור אדמין לפני שהוא נכנס להשוואות */
export const APPROVAL_THRESHOLD = 0.3;

export type PriceChangeStatus = "LIVE" | "PENDING_APPROVAL";

export function priceChangeStatus(currentAgorot: number | null, newAgorot: number): PriceChangeStatus {
  if (currentAgorot === null || currentAgorot <= 0) return "LIVE";
  const change = Math.abs(newAgorot - currentAgorot) / currentAgorot;
  return change > APPROVAL_THRESHOLD ? "PENDING_APPROVAL" : "LIVE";
}

/** "34.90" → 3490; מחזיר null לערך ריק או לא תקין */
export function parseShekels(value: FormDataEntryValue | null | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.replace(/[₪,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** סוג המחיר שהספק בוחר בטופס */
export type PriceType = "FIXED" | "UNTIL" | "PROMOTION";

/** מחיר עם תוקף או מבצע: עד שנה קדימה */
export const MAX_VALID_DAYS = 365;

/**
 * "2026-11-30" → תחילת היום שאחרי (המחיר תקף עד סוף 30.11).
 * מחזיר null לתאריך חסר או לא תקין, תאריך שעבר, או יותר משנה קדימה.
 */
export function parseValidUntil(value: FormDataEntryValue | null | undefined, now = new Date()): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const day = new Date(y, m, d);
  if (day.getFullYear() !== y || day.getMonth() !== m || day.getDate() !== d) return null;
  const end = new Date(y, m, d + 1);
  if (end <= now) return null;
  if (end.getTime() - now.getTime() > (MAX_VALID_DAYS + 1) * 86_400_000) return null;
  return end;
}

/** Date של validTo → "yyyy-mm-dd" של היום האחרון בתוקף, לשדה תאריך בטופס */
export function validUntilInput(validTo: Date | null | undefined) {
  if (!validTo) return "";
  const last = new Date(validTo.getTime() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
}
