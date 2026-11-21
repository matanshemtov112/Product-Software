/** שורה שהלקוח אישר במסך הבדיקה: מוצר מהקטלוג, הכמות בחשבונית והמחיר ליחידה */
export interface ConfirmedLine {
  productId: string;
  quantity: number;
  unitPriceAgorot: number | null;
  /** הלקוח רוצה להשוות רק למותג הזה; null = כל מותג */
  preferredBrand?: string | null;
}

export interface InvoiceBasketItem {
  productId: string;
  monthlyQuantity: number;
  currentUnitPriceAgorot: number | null;
  preferredBrand: string | null;
}

/**
 * הופך את השורות שאושרו לפריטי סל חודשי: הכמות מוכפלת במספר החשבוניות בחודש,
 * ומוצר שמופיע בכמה שורות מתאחד לשורה אחת עם מחיר ממוצע משוקלל.
 * מותג שהלקוח בחר "להשוות רק אליו" נשמר כמותג המועדף של המוצר בסל.
 */
export function basketItemsFromInvoice(lines: ConfirmedLine[], invoicesPerMonth: number): InvoiceBasketItem[] {
  const byProduct = new Map<string, { quantity: number; priced: number; paid: number; brands: (string | null)[] }>();
  for (const line of lines) {
    if (!(line.quantity > 0)) continue;
    const entry = byProduct.get(line.productId) ?? { quantity: 0, priced: 0, paid: 0, brands: [] };
    entry.quantity += line.quantity;
    entry.brands.push(line.preferredBrand?.trim() || null);
    if (line.unitPriceAgorot !== null) {
      entry.priced += line.quantity;
      entry.paid += line.quantity * line.unitPriceAgorot;
    }
    byProduct.set(line.productId, entry);
  }
  return [...byProduct].map(([productId, e]) => ({
    productId,
    monthlyQuantity: Math.round(e.quantity * invoicesPerMonth * 100) / 100,
    currentUnitPriceAgorot: e.priced > 0 ? Math.round(e.paid / e.priced) : null,
    // אותו מוצר בכמה שורות: מותג מועדף רק אם בכל השורות ביקשו את אותו מותג
    preferredBrand: e.brands.every((b) => b !== null && b === e.brands[0]) ? e.brands[0] : null,
  }));
}
