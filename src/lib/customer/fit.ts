import { PREFERENCE_WEIGHTS, type Preference, type SupplierInput } from "@/lib/engine";
import { shekels } from "@/lib/format";

/** כמה מהציון נקבע לפי כיסוי הסל; השאר לפי מחיר, דירוג ואמינות לפי העדפת הלקוח */
export const COVERAGE_WEIGHT = 0.4;

export interface FitInput {
  supplierId: string;
  supplierName: string;
  supplier: SupplierInput;
  /** מספר המוצרים מהסל שהספק מכסה */
  covered: number;
  categories: string[];
  totalAgorot: number;
  deliveryAgorot: number;
  /** החלופה הזולה ביותר לאותם מוצרים, מכל הספקים */
  bestAlternativeAgorot: number;
  gapAgorot: number;
  tierName: string;
}

export interface SupplierFit extends FitInput {
  /** 0 עד 100 */
  score: number;
  labels: string[];
  reasons: string[];
}

/**
 * מדרג את הספקים לפי ההתאמה לסל: כמה מהסל הם מכסים, כמה הם יקרים מהחלופה הזולה לאותם מוצרים,
 * ודירוג ואמינות, במשקלים של העדפת הלקוח. דירוג חסר נחשב ניטרלי (4).
 */
export function rankSuppliers(rows: FitInput[], lineCount: number, preference: Preference): SupplierFit[] {
  const w = PREFERENCE_WEIGHTS[preference];
  const ranked = rows.map((r): SupplierFit => {
    const coverage = lineCount ? r.covered / lineCount : 0;
    const price = r.totalAgorot ? r.bestAlternativeAgorot / r.totalAgorot : 0;
    const rating = (r.supplier.rating ?? 4) / 5;
    const rest = w.price * price + w.service * rating + w.reliability * r.supplier.reliability;
    const score = Math.round(100 * (COVERAGE_WEIGHT * coverage + (1 - COVERAGE_WEIGHT) * rest));

    const reasons = [
      r.covered === lineCount
        ? "מכסה את כל הסל"
        : `מכסה ${r.covered} מתוך ${lineCount} מוצרים: ${r.categories.join(", ")}`,
      r.gapAgorot
        ? `יקר ב-${shekels(r.gapAgorot)} (${((r.gapAgorot / r.bestAlternativeAgorot) * 100).toFixed(1)}%) מהחלופה הזולה לאותם מוצרים`
        : "הכי זול לאותם מוצרים",
      r.supplier.rating !== null ? `דירוג ${r.supplier.rating.toFixed(1)} מתוך 5` : "עוד אין מספיק דירוגים",
      `אמינות ${Math.round(r.supplier.reliability * 100)}%`,
      r.deliveryAgorot ? `משלוחים ${shekels(r.deliveryAgorot)} בחודש` : "משלוח חינם",
      `מדרגת מחיר: ${r.tierName}`,
    ];
    return { ...r, score, labels: [], reasons };
  });
  ranked.sort((a, b) => b.score - a.score || a.totalAgorot - b.totalAgorot);

  if (ranked[0]) ranked[0].labels.push("הכי מתאים לסל");
  const full = ranked.filter((r) => r.covered === lineCount);
  if (full.length) full.reduce((a, b) => (b.totalAgorot < a.totalAgorot ? b : a)).labels.push("ספק אחד לכל הסל");
  for (const r of ranked) if (r.gapAgorot === 0 && r.covered > 0) r.labels.push("הכי זול לחלק שלו");
  return ranked;
}
