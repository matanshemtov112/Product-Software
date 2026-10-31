import type { PaidComparisonLine } from "./paid-prices";

/** מחיר עד 2% מעל הזול ביותר עדיין נחשב תחרותי */
const COMPETITIVE_PCT = 2;

export type SupplierStatus = "competitive" | "check" | "expensive";

export const STATUS_LABEL: Record<SupplierStatus, string> = {
  competitive: "תחרותי",
  check: "כדאי לבדוק",
  expensive: "יקר יחסית",
};

export interface SupplierScore {
  products: number;
  /** מוצרים שהמחיר אצל הספק הוא הטוב ביותר שמצאנו (או קרוב אליו) */
  competitiveProducts: number;
  /** מוצרים שיש להם חלופה זולה יותר במערכת */
  cheaperElsewhere: number;
  /** הפער הממוצע מעל המחיר הזול ביותר, משוקלל לפי ההוצאה החודשית; מחיר שלכם זול יותר נספר כ-0 */
  avgGapPct: number;
  monthlySavingAgorot: number;
  /** ציון 0–100: כל אחוז פער ממוצע מוריד 4 נקודות */
  score: number;
  status: SupplierStatus;
  /** ההסבר לציון, כי הוא הערכה ולא עובדה */
  reasons: string[];
}

/**
 * ציון תחרותיות לספק שהלקוח עובד איתו, לפי המחירים שהלקוח משלם לו מול ההצעות במערכת.
 * רק מוצרים שיש להם הצעה במערכת נכנסים לחישוב.
 */
export function scoreSupplier(lines: PaidComparisonLine[]): SupplierScore {
  const compared = lines.filter((l) => l.gapPct !== null);
  const spend = compared.reduce((sum, l) => sum + l.paidAgorot * l.quantity, 0);
  const avgGapPct = spend
    ? Math.round(
        (compared.reduce((sum, l) => sum + Math.max(0, l.gapPct!) * l.paidAgorot * l.quantity, 0) / spend) * 10,
      ) / 10
    : 0;
  const competitiveProducts = compared.filter((l) => l.gapPct! <= COMPETITIVE_PCT).length;
  const cheaperElsewhere = compared.length - competitiveProducts;
  const monthlySavingAgorot = lines.reduce((sum, l) => sum + l.monthlySavingAgorot, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - 4 * avgGapPct)));
  const status: SupplierStatus = avgGapPct <= 3 ? "competitive" : avgGapPct <= 10 ? "check" : "expensive";

  const reasons = [
    `${competitiveProducts} מתוך ${compared.length} המוצרים שהשווינו במחיר הטוב ביותר שמצאנו או קרוב אליו.`,
    avgGapPct > 0
      ? `בממוצע אתם משלמים כ-${avgGapPct.toLocaleString("he-IL")}% מעל המחיר הנמוך במערכת.`
      : "אתם לא משלמים יותר מהמחיר הנמוך במערכת באף מוצר.",
  ];
  if (cheaperElsewhere > 0) reasons.push(`ל-${cheaperElsewhere} מוצרים יש חלופה זולה יותר אצל ספק אחר.`);
  if (lines.length > compared.length)
    reasons.push(`${lines.length - compared.length} מוצרים לא נכנסו לחישוב, כי אין להם עדיין הצעה במערכת.`);

  return {
    products: lines.length,
    competitiveProducts,
    cheaperElsewhere,
    avgGapPct,
    monthlySavingAgorot,
    score,
    status,
    reasons,
  };
}
