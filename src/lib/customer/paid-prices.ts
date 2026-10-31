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
  priceKind?: string;
  priceUpdatedAt?: string;
}

export interface PaidComparisonLine extends PaidItem {
  paidAgorot: number;
  /** ההצעה הזולה ביותר במערכת למוצר; null אם אף ספק לא מוכר אותו */
  best: SystemOffer | null;
  /** כל ההצעות במערכת למוצר, מהזולה ליקרה (ספק אחד פעם אחת) */
  offers: SystemOffer[];
  /** בכמה אחוזים הלקוח משלם יותר מהמחיר הזול ביותר (שלילי אם הוא משלם פחות); null בלי הצעה */
  gapPct: number | null;
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
  const byProduct = new Map<string, SystemOffer[]>();
  for (const o of offers) {
    const list = byProduct.get(o.productId) ?? [];
    const same = list.findIndex((x) => x.supplierId === o.supplierId);
    if (same === -1) list.push(o);
    else if (o.unitPriceAgorot < list[same].unitPriceAgorot) list[same] = o;
    byProduct.set(o.productId, list);
  }
  for (const list of byProduct.values()) list.sort((a, b) => a.unitPriceAgorot - b.unitPriceAgorot);
  const lines: PaidComparisonLine[] = [];
  const bySupplier = new Map<string, SupplierSaving>();
  for (const item of items) {
    if (item.paidAgorot === null) continue;
    const productOffers = byProduct.get(item.productId) ?? [];
    const best = productOffers[0] ?? null;
    const saving = best ? Math.max(0, Math.round((item.paidAgorot - best.unitPriceAgorot) * item.quantity)) : 0;
    const gapPct = best
      ? Math.round(((item.paidAgorot - best.unitPriceAgorot) / best.unitPriceAgorot) * 1000) / 10
      : null;
    lines.push({
      ...item,
      paidAgorot: item.paidAgorot,
      best,
      offers: productOffers,
      gapPct,
      monthlySavingAgorot: saving,
    });
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
