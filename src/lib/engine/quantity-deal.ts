/**
 * מבצע כמות: מכמות מסוימת בהזמנה בודדת המחיר יורד.
 * הכמות נבדקת לכל הזמנה: הכמות החודשית לחיוב ÷ מספר האספקות בחודש.
 */
export interface QuantityDealInput {
  /** הכמות המינימלית בהזמנה, ביחידות בסיס */
  minPerOrder: number;
  minPacks?: number | null;
  /** אחוז הנחה מהמחיר במדרגה */
  discountPct?: number | null;
  /** או מחיר ליחידת בסיס במבצע */
  priceAgorot?: number | null;
  /** סוף המבצע (ISO) */
  validTo?: string | null;
}

export interface DealResult {
  unitPriceAgorot: number;
  applied: boolean;
  /** כמה יחידות בסיס בהזמנה הלקוח מזמין אצל הספק */
  perOrder: number;
  /** כמה חסר בכל הזמנה כדי לקבל את המבצע (0 כשחל) */
  missingPerOrder: number;
}

/** המחיר במבצע אם הוא חל, אחרת המחיר הרגיל */
export function applyQuantityDeal(
  unitPriceAgorot: number,
  deal: QuantityDealInput | undefined,
  billedQuantity: number,
  deliveriesPerMonth: number,
): DealResult | null {
  if (!deal) return null;
  const perOrder = Math.round((billedQuantity / Math.max(1, deliveriesPerMonth)) * 1000) / 1000;
  const dealPrice =
    deal.priceAgorot != null
      ? Math.min(unitPriceAgorot, deal.priceAgorot)
      : Math.round(unitPriceAgorot * (1 - (deal.discountPct ?? 0) / 100));
  // מבצע שלא מוזיל (למשל מחיר מבצע גבוה ממחיר המדרגה של הלקוח) לא מוצג
  if (dealPrice >= unitPriceAgorot) return null;
  const applied = perOrder + 1e-9 >= deal.minPerOrder;
  return {
    unitPriceAgorot: applied ? dealPrice : unitPriceAgorot,
    applied,
    perOrder,
    missingPerOrder: applied ? 0 : Math.round((deal.minPerOrder - perOrder) * 1000) / 1000,
  };
}
