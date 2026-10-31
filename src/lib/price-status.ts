/** מחיר שהספק עדכן או אישר בתקופה הזו נחשב מאומת */
export const VERIFIED_DAYS = 30;

export type PriceStatusKey = "verified" | "list" | "promotion";

export interface PriceStatus {
  key: PriceStatusKey;
  label: string;
  /** מקור המחיר ומתי עודכן, למשל "הספק עדכן לפני 3 ימים" */
  detail: string;
}

const DAY = 86_400_000;

function ago(days: number) {
  if (days < 1) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/**
 * הסטטוס של מחיר במערכת: מבצע, מאומת (הספק עדכן לאחרונה) או מחירון (פורסם מזמן).
 * כל המחירים במערכת מגיעים מהספק עצמו; מחיר שלא עודכן זמן רב עלול להשתנות.
 */
export function priceStatus(price: { kind?: string; updatedAt?: string | null }, now = new Date()): PriceStatus {
  const days = price.updatedAt ? Math.floor((now.getTime() - new Date(price.updatedAt).getTime()) / DAY) : null;
  const when = days === null ? "" : `, ${ago(days)}`;
  if (price.kind === "PROMOTION") return { key: "promotion", label: "מבצע", detail: `מבצע של הספק${when}` };
  if (days !== null && days <= VERIFIED_DAYS)
    return { key: "verified", label: "מחיר מאומת", detail: `הספק עדכן את המחיר${when}` };
  return { key: "list", label: "מחיר מחירון", detail: `מחירון שהספק פרסם${when}` };
}
