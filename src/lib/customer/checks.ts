import type { BasketAnalysis } from "./quotes";

/** מה נשמר מבדיקה של סל, כדי להשוות אליה בבדיקה הבאה */
export interface CheckSnapshot {
  lowestCostAgorot: number | null;
  recommendedAgorot: number | null;
  suppliers: Record<string, { name: string; totalAgorot: number; items: number }>;
}

export function checkSnapshot(analysis: BasketAnalysis): CheckSnapshot {
  return {
    lowestCostAgorot: analysis.result.lowestCost?.totalAgorot ?? null,
    recommendedAgorot: analysis.result.recommended?.totalAgorot ?? null,
    suppliers: Object.fromEntries(
      analysis.rows.map((r) => [
        r.supplierId,
        { name: r.supplierName, totalAgorot: r.quote.share.totalAgorot, items: r.snapshot.lines.length },
      ]),
    ),
  };
}

export function isCheckSnapshot(value: unknown): value is CheckSnapshot {
  return typeof value === "object" && value !== null && typeof (value as CheckSnapshot).suppliers === "object";
}

/** שינוי קטן משקל אחד בחודש הוא רעש של עיגול, לא שינוי מחיר */
export const MIN_CHANGE_AGOROT = 100;

export interface SupplierChange {
  supplierId: string;
  name: string;
  /** "changed": אותם מוצרים, מחיר אחר. "new": ספק שלא היה בבדיקה הקודמת. "gone": ספק שכבר לא מציע */
  kind: "changed" | "new" | "gone";
  beforeAgorot: number | null;
  afterAgorot: number | null;
}

/**
 * ההבדלים מאז הבדיקה הקודמת: העלות הזולה ביותר, וכל ספק שהמחיר שלו לסל השתנה.
 * ספק שמכסה מספר אחר של מוצרים מסומן כחדש, כי אין טעם להשוות את הסכומים.
 */
export function compareChecks(before: CheckSnapshot, now: CheckSnapshot) {
  const changes: SupplierChange[] = [];
  for (const [id, after] of Object.entries(now.suppliers)) {
    const prev = before.suppliers[id];
    if (!prev || prev.items !== after.items) {
      changes.push({ supplierId: id, name: after.name, kind: "new", beforeAgorot: null, afterAgorot: after.totalAgorot });
    } else if (Math.abs(prev.totalAgorot - after.totalAgorot) >= MIN_CHANGE_AGOROT) {
      changes.push({
        supplierId: id,
        name: after.name,
        kind: "changed",
        beforeAgorot: prev.totalAgorot,
        afterAgorot: after.totalAgorot,
      });
    }
  }
  for (const [id, prev] of Object.entries(before.suppliers)) {
    if (!now.suppliers[id]) {
      changes.push({ supplierId: id, name: prev.name, kind: "gone", beforeAgorot: prev.totalAgorot, afterAgorot: null });
    }
  }
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);
  return {
    lowestDeltaAgorot: delta(before.lowestCostAgorot, now.lowestCostAgorot),
    changes: changes.sort(
      (a, b) => (a.afterAgorot ?? 0) - (a.beforeAgorot ?? 0) - ((b.afterAgorot ?? 0) - (b.beforeAgorot ?? 0)),
    ),
  };
}
