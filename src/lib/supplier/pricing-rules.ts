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
