/** תקופת מחיר: מתי נכנס לתוקף ועד מתי (null = עדיין בתוקף) */
export interface PricePeriod {
  from: string;
  to: string | null;
  price: number;
}

/**
 * המחיר שהיה בתוקף ביום מסוים (yyyy-mm-dd): כשהמחיר השתנה באותו יום, המחיר האחרון שנכנס לתוקף באותו יום.
 * בדיווח על הפרת מחיר זה המחיר שהלקוח ראה ביום האספקה, ולא המחיר של היום.
 */
export function priceOn(periods: PricePeriod[], day: string): number | null {
  const start = new Date(`${day}T00:00:00`).getTime();
  const end = start + 86_400_000;
  if (Number.isNaN(start)) return null;
  const valid = periods.filter(
    (p) => new Date(p.from).getTime() < end && (p.to === null || new Date(p.to).getTime() > start),
  );
  if (valid.length === 0) return null;
  // מבצע ומחיר רגיל באותו רגע: הזול מביניהם; אחרת המחיר שנכנס לתוקף אחרון
  const latest = Math.max(...valid.map((p) => new Date(p.from).getTime()));
  const open = valid.filter((p) => p.to === null || new Date(p.to).getTime() > Math.min(end - 1, Date.now()));
  const pool = open.length ? open : valid.filter((p) => new Date(p.from).getTime() === latest);
  return Math.min(...pool.map((p) => p.price));
}
