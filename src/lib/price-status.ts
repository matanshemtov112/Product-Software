/** מחיר שהספק עדכן או אישר בתקופה הזו נחשב עדכני */
export const VERIFIED_DAYS = 30;

/**
 * סוג המחיר, כפי שהספק בחר:
 * - fixed: מחיר קבוע, בלי תאריך סיום.
 * - until: מחיר עם תוקף. אחרי התאריך הוא יוצא מההשוואות עד שהספק מעדכן.
 * - promotion: מבצע עד תאריך. אחריו חוזר המחיר הקבוע של הספק.
 */
export type PriceStatusKey = "fixed" | "until" | "promotion";

export const PRICE_TYPE_LABEL: Record<PriceStatusKey, string> = {
  fixed: "מחיר קבוע",
  until: "מחיר עם תוקף",
  promotion: "מבצע",
};

export interface PriceStatus {
  key: PriceStatusKey;
  /** למשל "מחיר קבוע", "בתוקף עד 30.11.2026", "מבצע עד 30.11.2026" */
  label: string;
  /** למשל "עודכן 05.11.2026"; ריק כשלא ידוע */
  updated: string;
  /** הסבר מלא לתצוגה בריחוף */
  detail: string;
  /** המחיר לא עודכן יותר מ-30 יום */
  stale: boolean;
}

const DAY = 86_400_000;

export const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

function ago(days: number) {
  if (days < 1) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/** תאריך הסיום כפי שמוצג: היום האחרון שהמחיר בתוקף (validTo הוא תחילת היום שאחריו) */
export function lastValidDay(validTo: Date | string) {
  return new Date(new Date(validTo).getTime() - 1);
}

/** סוג המחיר, מתי עודכן ועד מתי הוא תקף, לתצוגה ליד המחיר */
export function priceStatus(
  price: { kind?: string; updatedAt?: string | Date | null; validTo?: string | Date | null },
  now = new Date(),
): PriceStatus {
  const days = price.updatedAt ? Math.floor((now.getTime() - new Date(price.updatedAt).getTime()) / DAY) : null;
  const updated = price.updatedAt ? `עודכן ${shortDate(price.updatedAt)}` : "";
  const when = days === null ? "" : ` הספק עדכן אותו ${ago(days)}.`;
  const until = price.validTo ? shortDate(lastValidDay(price.validTo)) : null;
  const stale = days !== null && days > VERIFIED_DAYS;
  if (price.kind === "PROMOTION") {
    return {
      key: "promotion",
      label: until ? `מבצע עד ${until}` : "מבצע",
      updated,
      detail: `מחיר מבצע${until ? ` עד ${until}` : ""}. אחריו חוזר המחיר הקבוע של הספק.${when}`,
      stale,
    };
  }
  if (until) {
    return {
      key: "until",
      label: `בתוקף עד ${until}`,
      updated,
      detail: `הספק התחייב למחיר הזה עד ${until}.${when}`,
      stale,
    };
  }
  return {
    key: "fixed",
    label: "מחיר קבוע",
    updated,
    detail: `מחיר קבוע של הספק, בלי תאריך סיום.${when}${stale ? " עבר יותר מחודש מאז העדכון, כדאי לוודא מול הספק." : ""}`,
    stale,
  };
}
