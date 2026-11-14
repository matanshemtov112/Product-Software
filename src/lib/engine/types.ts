import type { QuantityDealInput } from "./quantity-deal";
// טיפוסי הקלט והפלט של מנוע אופטימיזציית הסל.
// המנוע טהור: אין בו גישה למסד נתונים, כך שאפשר לבדוק אותו בבדיקות יחידה.
// כל הסכומים באגורות, ללא מע״מ.

import type { PackInfo } from "@/lib/pack";

export type Preference = "PRICE" | "BALANCED" | "SERVICE";
export type PriceKind = "REGULAR" | "PROMOTION";

export interface BasketLine {
  productId: string;
  productName: string;
  /** כמות חודשית ביחידות בסיס (ק״ג, ליטר, יחידה) */
  quantity: number;
  /** ספקים שהלקוח החריג עבור הפריט הזה */
  excludedSupplierIds?: string[];
  /** מותג שהלקוח רוצה דווקא (למשל "סוגת"); חסר = כל מותג */
  brand?: string;
}

export interface TierPrice {
  unitPriceAgorot: number;
  kind: PriceKind;
  /** מתי הספק עדכן או אישר את המחיר (ISO), להצגת סטטוס המחיר */
  updatedAt?: string;
  /** עד מתי המחיר תקף (ISO); חסר למחיר קבוע */
  validTo?: string;
  /** במבצע: המחיר הרגיל האמיתי של הספק באותה מדרגה (מוצג עם קו) */
  regularAgorot?: number;
}

export interface Offer {
  /** מזהה ההצעה במסד; ספק יכול להחזיק כמה הצעות (אריזות) לאותו מוצר */
  offerId?: string;
  productId: string;
  /** גודל אריזה ביחידות בסיס; הכמות מעוגלת כלפי מעלה לכפולה שלו */
  packSize: number;
  /** המותג של המוצר אצל הספק, כפי שהספק כתב אותו */
  brand?: string;
  /** סימון ללקוח על שינוי אחרון: אריזה שהשתנתה או מוצר חלופי */
  changeNote?: string;
  minQuantity?: number;
  /** לתצוגה: איך המוצר מגיע והמינימום להזמנה, למשל "קרטון 15–20 ק״ג" */
  packLabel?: string;
  minOrderLabel?: string | null;
  /** לתצוגה: נתוני האריזה, לחישוב המחיר לאריזה */
  packInfo?: Pick<PackInfo, "unit" | "packType" | "packSize" | "packSizeMax"> & { pricePerPack: boolean };
  /** מחיר לפי מזהה מדרגה */
  prices: Record<string, TierPrice>;
  /** מבצע כמות בתוקף, אם יש */
  quantityDeal?: QuantityDealInput;
}

export interface Tier {
  id: string;
  name: string;
  minMonthlyAgorot: number;
}

export interface SupplierInput {
  id: string;
  name: string;
  /** מינימום הזמנה לאספקה בודדת */
  minOrderAgorot: number;
  /** דירוג ממוצע 1 עד 5; null לספק בלי מספיק ביקורות */
  rating: number | null;
  /** אמינות 0 עד 1 */
  reliability: number;
  delivery: { feeAgorot: number; freeAboveAgorot: number | null };
  tiers: Tier[];
  offers: Offer[];
}

export interface EngineOptions {
  preference: Preference;
  deliveriesPerMonth: number;
  /** מספר הספקים המרבי בצירוף; ברירת מחדל 4 */
  maxSuppliers?: number;
  /** מספר הספקים הרלוונטיים המרבי שנבדקים; ברירת מחדל 20 */
  maxCandidates?: number;
  /** דירוג שמשמש ספק בלי מספיק ביקורות; ברירת מחדל 4 */
  neutralRating?: number;
  /**
   * מכפיל להיקף אצל כל ספק בקביעת מדרגת המחיר, כשהלקוח קונה בחודש יותר מהסל (volumeScale).
   * ברירת מחדל 1: המדרגה נקבעת לפי הסל בלבד.
   */
  volumeScale?: number;
  /** העלות החודשית הנוכחית של הלקוח, לחישוב חיסכון */
  currentCostAgorot?: number | null;
}

export interface PricedLine {
  productId: string;
  productName: string;
  /** האריזה שנבחרה: מזהה ההצעה, איך המוצר מגיע וגודל האריזה ביחידות בסיס */
  offerId?: string;
  packLabel?: string;
  packSize?: number;
  /** המותג של ההצעה שנבחרה */
  brand?: string;
  /** סימון על שינוי אחרון במוצר (אריזה שהשתנתה, מוצר חלופי) */
  changeNote?: string;
  /** אריזות אחרות של אותו ספק לאותו מוצר, שיצאו יקרות יותר לכמות של הלקוח */
  otherPacks?: { offerId?: string; packLabel?: string; packSize: number; unitPriceAgorot: number }[];
  quantity: number;
  billedQuantity: number;
  unitPriceAgorot: number;
  lineTotalAgorot: number;
  priceKind: PriceKind;
  priceUpdatedAt?: string;
  priceValidTo?: string;
  /**
   * המחיר הרגיל האמיתי של הספק ליחידה, כשהמחיר בשורה נמוך ממנו בגלל מבצע או מבצע כמות.
   * מוצג עם קו ליד המחיר. חסר כשאין מבצע.
   */
  regularUnitAgorot?: number;
  /** מבצע כמות של הספק למוצר: האם חל על הלקוח, ומה חסר כדי שיחול */
  deal?: QuantityDealInput & { applied: boolean; perOrder: number; missingPerOrder: number };
}

export interface SupplierShare {
  supplierId: string;
  supplierName: string;
  tierName: string;
  lines: PricedLine[];
  productsAgorot: number;
  deliveryAgorot: number;
  totalAgorot: number;
}

export interface Plan {
  suppliers: SupplierShare[];
  productsAgorot: number;
  deliveryAgorot: number;
  totalAgorot: number;
  /** פריטים שאף ספק בצירוף לא מוכר */
  missingProductIds: string[];
  score: number;
  explanation: string[];
}

export interface EngineResult {
  /** אפשרות א: העלות הכוללת הנמוכה ביותר */
  lowestCost: Plan | null;
  /** אפשרות ב: ספק יחיד */
  singleSupplier: Plan | null;
  /** אפשרות ג: שילוב מומלץ לפי הציון המשוקלל */
  recommended: Plan | null;
  monthlySavingsAgorot: number | null;
  annualSavingsAgorot: number | null;
  evaluatedCombinations: number;
}
