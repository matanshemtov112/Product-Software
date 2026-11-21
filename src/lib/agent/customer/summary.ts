import { shekels, UNIT_LABEL } from "@/lib/format";
import type { BasketAnalysis } from "@/lib/customer/quotes";
import type { Plan } from "@/lib/engine";

/**
 * תקצירים קטנים למודל מתוך נתוני המערכת. רק מה שהלקוח עצמו רואה בדפים שלו:
 * בלי פרטי קשר של ספקים ובלי מידע על לקוחות אחרים.
 */

export interface BasketItemInput {
  productId: string;
  monthlyQuantity: number;
  preferredBrand?: string | null;
}

/** מיזוג שינויים לרשימת המוצרים של סל: עדכון או הוספה, ואז הסרה */
export function mergeItems(
  current: BasketItemInput[],
  set: BasketItemInput[],
  remove: string[],
): BasketItemInput[] {
  const map = new Map(current.map((i) => [i.productId, { ...i }]));
  for (const s of set) {
    const prev = map.get(s.productId);
    map.set(s.productId, {
      productId: s.productId,
      monthlyQuantity: s.monthlyQuantity,
      // מותג שלא צוין בעדכון נשאר כמו שהיה; מחרוזת ריקה = כל מותג
      preferredBrand: s.preferredBrand === undefined ? (prev?.preferredBrand ?? null) : s.preferredBrand?.trim() || null,
    });
  }
  for (const id of remove) map.delete(id);
  return [...map.values()];
}

const money = (agorot: number | null | undefined) => (agorot == null ? null : shekels(agorot));

function planSummary(plan: Plan | null, names: Map<string, string>) {
  if (!plan) return null;
  return {
    totalPerMonth: money(plan.totalAgorot),
    suppliers: plan.suppliers.map((s) => ({
      name: s.supplierName,
      totalPerMonth: money(s.totalAgorot),
      products: s.lines.map((l) => l.productName),
    })),
    missingProducts: plan.missingProductIds.map((id) => names.get(id) ?? id),
    explanation: plan.explanation,
  };
}

/** ההשוואה של סל אחד, בתקציר שמתאים למודל */
export function analysisSummary(analysis: BasketAnalysis, names: Map<string, string>) {
  const { result } = analysis;
  return {
    productsCompared: analysis.lineCount,
    monthlySaving: money(result.monthlySavingsAgorot),
    annualSaving: money(result.annualSavingsAgorot),
    options: {
      lowestCost: planSummary(result.lowestCost, names),
      singleSupplier: planSummary(result.singleSupplier, names),
      recommended: planSummary(result.recommended, names),
    },
    suppliersRanked: analysis.rows.slice(0, 8).map((r) => ({
      supplierId: r.supplierId,
      name: r.supplierName,
      totalPerMonth: money(r.snapshot.totalAgorot),
      gapVsCheapestPerMonth: money(r.quote.gapAgorot),
      productsCovered: r.quote.share.lines.length,
      minOrder: r.supplier.minOrderAgorot ? money(r.supplier.minOrderAgorot) : null,
    })),
    belowMinimumOrder: analysis.belowMinimum.map((b) => ({
      name: b.supplierName,
      minOrder: money(b.minOrderAgorot),
      basketPartPerMonth: money(b.share.totalAgorot),
    })),
    brandRequests: analysis.brandChoices.map((c) => ({
      product: c.productName,
      brand: c.brand,
      cheapestInBrand: c.exact ? { supplier: c.exact.supplierName, unitPrice: money(c.exact.unitPriceAgorot) } : null,
      cheaperSimilar: c.similar
        ? { supplier: c.similar.supplierName, brand: c.similar.brand ?? null, unitPrice: money(c.similar.unitPriceAgorot) }
        : null,
      monthlySavingWithSimilar: money(c.similarSavingAgorot),
    })),
  };
}

export function quantityText(quantity: number, unit: keyof typeof UNIT_LABEL) {
  return `${quantity.toLocaleString("he-IL")} ${UNIT_LABEL[unit]} בחודש`;
}
