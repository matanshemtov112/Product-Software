/**
 * כשאף ספק לא מכסה את כל הסל: אילו ספקים קרובים לכסות אותו, אילו מוצרים חסרים אצל כל אחד,
 * ומאיפה אפשר לקנות את המוצרים החסרים בנפרד. כך הלקוח יכול להחליט לעבוד עם ספק אחד
 * ולהפריד רק מוצר או שניים.
 */

export interface SplitRow {
  supplierId: string;
  supplierName: string;
  minOrderAgorot: number;
  /** הפריטים שהספק מוכר מהסל, במחיר שלו ללקוח */
  lines: { productId: string; unitPriceAgorot: number; lineTotalAgorot: number }[];
  totalAgorot: number;
  /** הספק לא מגיע למינימום ההזמנה שלו גם עם כל מה שהוא מוכר מהסל */
  belowMinimum?: boolean;
}

export interface SplitItem {
  productId: string;
  name: string;
}

export interface MissingProduct {
  productId: string;
  name: string;
  /** הספק הזול ביותר שמוכר את המוצר; null כשאף ספק אחר לא מוכר אותו */
  from: { supplierId: string; supplierName: string; unitPriceAgorot: number } | null;
}

export interface SeparateOrder {
  supplierId: string;
  supplierName: string;
  products: string[];
  /** בערך כמה תהיה כל אספקה נפרדת מהספק הזה */
  perDeliveryAgorot: number;
  minOrderAgorot: number;
  belowMinimum: boolean;
}

export interface SplitCandidate {
  supplierId: string;
  supplierName: string;
  coveredCount: number;
  totalAgorot: number;
  /** גם בלי המוצרים החסרים, ההזמנה מהספק לא מגיעה למינימום שלו */
  belowMinimum: boolean;
  minOrderAgorot: number;
  missing: MissingProduct[];
  separate: SeparateOrder[];
}

export interface SplitAdvice {
  itemCount: number;
  candidates: SplitCandidate[];
  /** מוצרים שאף ספק באזור לא מוכר */
  nobodySells: string[];
}

/** כמה ספקים קרובים להציג, ועד כמה מוצרים חסרים ספק נחשב "קרוב" */
const MAX_CANDIDATES = 3;
const CLOSE_ENOUGH = 3;

export function splitAdvice(items: SplitItem[], rows: SplitRow[], deliveriesPerMonth: number): SplitAdvice | null {
  if (items.length === 0 || rows.length === 0) return null;
  const sells = (r: SplitRow, productId: string) => r.lines.some((l) => l.productId === productId);
  const nobody = items.filter((i) => !rows.some((r) => sells(r, i.productId)));
  const fixable = items.filter((i) => !nobody.includes(i));
  // יש ספק שמוכר את כל מה שאפשר לקנות במערכת: אין מה להפריד
  if (rows.some((r) => !r.belowMinimum && fixable.every((i) => sells(r, i.productId)))) {
    return nobody.length > 0
      ? { itemCount: items.length, candidates: [], nobodySells: nobody.map((i) => i.name) }
      : null;
  }

  const deliveries = Math.max(1, deliveriesPerMonth);
  const ranked = rows
    .map((r) => ({ r, missing: fixable.filter((i) => !sells(r, i.productId)) }))
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        Number(a.r.belowMinimum ?? false) - Number(b.r.belowMinimum ?? false) ||
        a.r.totalAgorot - b.r.totalAgorot,
    );
  const close = ranked.filter((c) => c.missing.length <= CLOSE_ENOUGH);
  const chosen = (close.length > 0 ? close : ranked.slice(0, 1)).slice(0, MAX_CANDIDATES);

  const candidates = chosen.map(({ r, missing }): SplitCandidate => {
    const separate = new Map<string, SeparateOrder>();
    const missingProducts = missing.map((item): MissingProduct => {
      let best: { row: SplitRow; unit: number; total: number } | null = null;
      for (const other of rows) {
        if (other.supplierId === r.supplierId) continue;
        const line = other.lines.find((l) => l.productId === item.productId);
        if (line && (!best || line.unitPriceAgorot < best.unit))
          best = { row: other, unit: line.unitPriceAgorot, total: line.lineTotalAgorot };
      }
      if (!best) return { productId: item.productId, name: item.name, from: null };
      const order = separate.get(best.row.supplierId) ?? {
        supplierId: best.row.supplierId,
        supplierName: best.row.supplierName,
        products: [],
        perDeliveryAgorot: 0,
        minOrderAgorot: best.row.minOrderAgorot,
        belowMinimum: false,
      };
      order.products.push(item.name);
      order.perDeliveryAgorot += Math.round(best.total / deliveries);
      order.belowMinimum = order.perDeliveryAgorot < order.minOrderAgorot;
      separate.set(best.row.supplierId, order);
      return {
        productId: item.productId,
        name: item.name,
        from: { supplierId: best.row.supplierId, supplierName: best.row.supplierName, unitPriceAgorot: best.unit },
      };
    });
    return {
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      coveredCount: r.lines.length,
      totalAgorot: r.totalAgorot,
      belowMinimum: r.belowMinimum ?? false,
      minOrderAgorot: r.minOrderAgorot,
      missing: missingProducts,
      separate: [...separate.values()],
    };
  });
  return { itemCount: items.length, candidates, nobodySells: nobody.map((i) => i.name) };
}
