import { optimizeBasket } from "./optimize";
import type { BasketLine, EngineOptions, SupplierShare, SupplierInput } from "./types";

export interface SupplierQuote {
  /** ההצעה של הספק לפריטים מהסל שהוא מוכר */
  share: SupplierShare;
  /** פריטים מהסל שהספק לא מוכר */
  missingProductIds: string[];
  /** העלות הזולה ביותר לאותם פריטים מכל הספקים יחד */
  bestAlternativeAgorot: number;
  /** כמה ההצעה של הספק יקרה מהחלופה הזולה; 0 אם הוא הזול ביותר */
  gapAgorot: number;
}

/**
 * ההצעה שספק אחד נותן ללקוח על הסל, והפער שלה מול החלופה הזולה ביותר לאותם פריטים.
 * זה הבסיס לפנייה של לקוח שרוצה לעבוד עם ספק מסוים למרות פער מחיר.
 * null אם הספק לא מוכר אף פריט מהסל או לא מגיע למינימום ההזמנה שלו.
 */
export function quoteForSupplier(
  lines: BasketLine[],
  suppliers: SupplierInput[],
  opts: EngineOptions,
  supplierId: string,
): SupplierQuote | null {
  const supplier = suppliers.find((s) => s.id === supplierId);
  if (!supplier) return null;
  const solo = optimizeBasket(lines, [supplier], { ...opts, maxSuppliers: 1 }).singleSupplier;
  const share = solo?.suppliers[0];
  if (!solo || !share) return null;

  const covered = new Set(share.lines.map((l) => l.productId));
  const best = optimizeBasket(
    lines.filter((l) => covered.has(l.productId)),
    suppliers,
    { ...opts, preference: "PRICE" },
  ).lowestCost;
  const bestAlternativeAgorot = Math.min(best?.totalAgorot ?? share.totalAgorot, share.totalAgorot);
  return {
    share,
    missingProductIds: solo.missingProductIds,
    bestAlternativeAgorot,
    gapAgorot: share.totalAgorot - bestAlternativeAgorot,
  };
}
