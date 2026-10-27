/** שורה שהלקוח אישר במסך הבדיקה: מוצר מהקטלוג, הכמות בחשבונית והמחיר ליחידה */
export interface ConfirmedLine {
  productId: string;
  quantity: number;
  unitPriceAgorot: number | null;
}

export interface InvoiceBasketItem {
  productId: string;
  monthlyQuantity: number;
  currentUnitPriceAgorot: number | null;
}

/**
 * הופך את השורות שאושרו לפריטי סל חודשי: הכמות מוכפלת במספר החשבוניות בחודש,
 * ומוצר שמופיע בכמה שורות מתאחד לשורה אחת עם מחיר ממוצע משוקלל.
 */
export function basketItemsFromInvoice(lines: ConfirmedLine[], invoicesPerMonth: number): InvoiceBasketItem[] {
  const byProduct = new Map<string, { quantity: number; priced: number; paid: number }>();
  for (const line of lines) {
    if (!(line.quantity > 0)) continue;
    const entry = byProduct.get(line.productId) ?? { quantity: 0, priced: 0, paid: 0 };
    entry.quantity += line.quantity;
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
  }));
}
