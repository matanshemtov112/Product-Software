/** מחירון של ספק במדרגה הבסיסית, כפי ש-supplierPriceList מחזיר */
export interface PriceList {
  id: string;
  name: string;
  items: { product: { id: string; name: string; unit: string; category: string }; priceAgorot: number | null }[];
}

export interface CompetitorLine {
  productId: string;
  productName: string;
  unit: string;
  currentAgorot: number;
  competitorAgorot: number;
}

export interface Competitor {
  supplierId: string;
  supplierName: string;
  /** מוצרים ששני הספקים מוכרים, עם מחיר אצל שניהם */
  lines: CompetitorLine[];
  /** כמה מהמוצרים של הספק הנוכחי המתחרה מוכר (0 עד 1) */
  coverage: number;
  cheaperCount: number;
  /** ממוצע ההפרש באחוזים על המוצרים המשותפים; שלילי = המתחרה זול יותר */
  avgDiffPct: number;
}

/**
 * מי מתחרה בספק שהלקוח עובד איתו היום: לכל ספק אחר, המוצרים המשותפים וההפרש במחיר.
 * ספק בלי מוצר משותף אחד לא מוצג. הסדר: קודם מי שמכסה יותר מהמוצרים, ובשוויון מי שזול יותר.
 */
export function findCompetitors(current: PriceList, others: PriceList[]): Competitor[] {
  const priced = new Map(
    current.items.filter((i) => i.priceAgorot != null).map((i) => [i.product.id, { ...i, priceAgorot: i.priceAgorot! }]),
  );
  if (priced.size === 0) return [];
  const result: Competitor[] = [];
  for (const other of others) {
    if (other.id === current.id) continue;
    const lines: CompetitorLine[] = [];
    for (const item of other.items) {
      const mine = priced.get(item.product.id);
      if (!mine || item.priceAgorot == null) continue;
      lines.push({
        productId: item.product.id,
        productName: item.product.name,
        unit: item.product.unit,
        currentAgorot: mine.priceAgorot,
        competitorAgorot: item.priceAgorot,
      });
    }
    if (lines.length === 0) continue;
    const pcts = lines.map((l) => ((l.competitorAgorot - l.currentAgorot) / l.currentAgorot) * 100);
    result.push({
      supplierId: other.id,
      supplierName: other.name,
      lines: lines.sort((a, b) => a.competitorAgorot / a.currentAgorot - b.competitorAgorot / b.currentAgorot),
      coverage: lines.length / priced.size,
      cheaperCount: lines.filter((l) => l.competitorAgorot < l.currentAgorot).length,
      avgDiffPct: pcts.reduce((s, p) => s + p, 0) / pcts.length,
    });
  }
  return result.sort((a, b) => b.lines.length - a.lines.length || a.avgDiffPct - b.avgDiffPct);
}
