export interface PaidItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  /** המחיר ליחידה שהלקוח משלם היום; null כשלא מילא */
  paidAgorot: number | null;
}

export interface SystemOffer {
  supplierId: string;
  supplierName: string;
  productId: string;
  /** המחיר ליחידה במדרגה שהלקוח מקבל אצל הספק */
  unitPriceAgorot: number;
}

export interface PaidComparisonLine extends PaidItem {
  paidAgorot: number;
  /** ההצעה הזולה ביותר במערכת למוצר; null אם אף ספק לא מוכר אותו */
  best: SystemOffer | null;
  /** כמה אפשר לחסוך בחודש על המוצר (0 אם המחיר של הלקוח טוב יותר או שווה) */
  monthlySavingAgorot: number;
}

export interface SupplierSaving {
  supplierId: string;
  supplierName: string;
  products: string[];
  monthlySavingAgorot: number;
}

export interface PaidComparison {
  lines: PaidComparisonLine[];
  /** ספקים שאצלם יש מוצרים זולים ממה שהלקוח משלם, מהחיסכון הגדול לקטן */
  suppliers: SupplierSaving[];
  monthlySavingAgorot: number;
}

/**
 * משווה את המחירים שהלקוח משלם היום מול ההצעה הזולה ביותר במערכת לכל מוצר.
 * רק מוצרים שהלקוח מילא להם מחיר נכנסים להשוואה. החיסכון הוא לפי מחיר ליחידה, לפני משלוח ומינימום הזמנה.
 */
export function comparePaidPrices(items: PaidItem[], offers: SystemOffer[]): PaidComparison {
  const cheapest = new Map<string, SystemOffer>();
  for (const o of offers) {
    const prev = cheapest.get(o.productId);
    if (!prev || o.unitPriceAgorot < prev.unitPriceAgorot) cheapest.set(o.productId, o);
  }
  const lines: PaidComparisonLine[] = [];
  const bySupplier = new Map<string, SupplierSaving>();
  for (const item of items) {
    if (item.paidAgorot === null) continue;
    const best = cheapest.get(item.productId) ?? null;
    const saving = best ? Math.max(0, Math.round((item.paidAgorot - best.unitPriceAgorot) * item.quantity)) : 0;
    lines.push({ ...item, paidAgorot: item.paidAgorot, best, monthlySavingAgorot: saving });
    if (best && saving > 0) {
      const s = bySupplier.get(best.supplierId) ?? {
        supplierId: best.supplierId,
        supplierName: best.supplierName,
        products: [],
        monthlySavingAgorot: 0,
      };
      s.products.push(item.productName);
      s.monthlySavingAgorot += saving;
      bySupplier.set(best.supplierId, s);
    }
  }
  lines.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot);
  const suppliers = [...bySupplier.values()].sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot);
  return { lines, suppliers, monthlySavingAgorot: suppliers.reduce((sum, s) => sum + s.monthlySavingAgorot, 0) };
}
