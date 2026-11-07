/**
 * עלות אפקטיבית: כמה באמת עולה להעביר מוצרים לספק אחר, ולא רק המחיר ליחידה.
 *
 * ההגדרה:
 * 1. לוקחים את כל המוצרים שהלקוח יקנה אצל הספק (בכמות החודשית).
 * 2. ההזמנה הבודדת = סכום המוצרים ÷ מספר האספקות בחודש. אם היא מתחת למינימום ההזמנה של הספק,
 *    אי אפשר להזמין ממנו רק את המוצרים האלה, והחיסכון לא נספר. מראים כמה חסר בכל הזמנה.
 * 3. מוסיפים משלוח לכל אספקה, אלא אם ההזמנה הבודדת עוברת את סף המשלוח החינם.
 *    ספק שהלקוח כבר מזמין ממנו ממילא: אין משלוח נוסף ואין בעיית מינימום.
 * 4. העלות האפקטיבית = מוצרים + משלוח. החיסכון האמיתי = מה שהלקוח משלם היום על אותם מוצרים פחות העלות האפקטיבית.
 *    ההצעה כדאית רק כשהחיסכון האמיתי חיובי.
 * כל הסכומים לחודש, באגורות, ללא מע״מ.
 */

export interface SupplierTerms {
  /** מינימום הזמנה לאספקה בודדת */
  minOrderAgorot: number;
  /** דמי משלוח לאספקה */
  feeAgorot: number;
  /** משלוח חינם מהסכום הזה בהזמנה בודדת; null אם אין */
  freeAboveAgorot: number | null;
}

export interface SwitchLine {
  quantity: number;
  /** המחיר ליחידה אצל הספק החדש */
  unitPriceAgorot: number;
  /** המחיר ליחידה שהלקוח משלם היום */
  paidAgorot: number;
}

export interface EffectiveCost {
  /** סכום המוצרים בחודש אצל הספק */
  productsAgorot: number;
  /** כמה הלקוח משלם היום בחודש על אותם מוצרים */
  paidAgorot: number;
  /** משלוח בחודש */
  deliveryAgorot: number;
  /** מוצרים + משלוח */
  totalAgorot: number;
  /** סכום ההזמנה הבודדת */
  perOrderAgorot: number;
  /** כמה חסר בכל הזמנה כדי להגיע למינימום (0 אם אין בעיה) */
  shortfallPerOrderAgorot: number;
  /** אפשר להזמין מהספק את המוצרים האלה (עובר את המינימום) */
  feasible: boolean;
  /** החיסכון לפי מחיר ליחידה בלבד */
  productSavingAgorot: number;
  /** החיסכון האמיתי אחרי משלוח (יכול להיות שלילי) */
  netSavingAgorot: number;
  /** אפשר להזמין, והחיסכון האמיתי חיובי */
  worthIt: boolean;
  /** הלקוח כבר מזמין מהספק הזה */
  alreadyOrdering: boolean;
}

export function effectiveCost(
  lines: SwitchLine[],
  terms: SupplierTerms,
  deliveriesPerMonth: number,
  alreadyOrdering = false,
): EffectiveCost {
  const deliveries = Math.max(1, deliveriesPerMonth);
  const productsAgorot = Math.round(lines.reduce((s, l) => s + l.unitPriceAgorot * l.quantity, 0));
  const paidAgorot = Math.round(lines.reduce((s, l) => s + l.paidAgorot * l.quantity, 0));
  const perOrderAgorot = Math.round(productsAgorot / deliveries);
  const shortfallPerOrderAgorot = alreadyOrdering ? 0 : Math.max(0, terms.minOrderAgorot - perOrderAgorot);
  const freeDelivery = terms.freeAboveAgorot !== null && perOrderAgorot >= terms.freeAboveAgorot;
  const deliveryAgorot = alreadyOrdering || freeDelivery ? 0 : terms.feeAgorot * deliveries;
  const totalAgorot = productsAgorot + deliveryAgorot;
  const feasible = shortfallPerOrderAgorot === 0;
  const netSavingAgorot = paidAgorot - totalAgorot;
  return {
    productsAgorot,
    paidAgorot,
    deliveryAgorot,
    totalAgorot,
    perOrderAgorot,
    shortfallPerOrderAgorot,
    feasible,
    productSavingAgorot: paidAgorot - productsAgorot,
    netSavingAgorot,
    worthIt: feasible && netSavingAgorot > 0,
    alreadyOrdering,
  };
}

/** למה הצעה זולה ליחידה לא נספרת כחיסכון */
export function blockedReason(c: EffectiveCost): "min-order" | "delivery" | null {
  if (!c.feasible) return "min-order";
  if (c.netSavingAgorot <= 0) return "delivery";
  return null;
}
