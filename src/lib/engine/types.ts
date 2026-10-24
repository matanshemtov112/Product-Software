// טיפוסי הקלט והפלט של מנוע אופטימיזציית הסל.
// המנוע טהור: אין בו גישה למסד נתונים, כך שאפשר לבדוק אותו בבדיקות יחידה.
// כל הסכומים באגורות, ללא מע״מ.

export type Preference = "PRICE" | "BALANCED" | "SERVICE";
export type PriceKind = "REGULAR" | "PROMOTION";

export interface BasketLine {
  productId: string;
  productName: string;
  /** כמות חודשית ביחידות בסיס (ק״ג, ליטר, יחידה) */
  quantity: number;
  /** ספקים שהלקוח החריג עבור הפריט הזה */
  excludedSupplierIds?: string[];
}

export interface TierPrice {
  unitPriceAgorot: number;
  kind: PriceKind;
}

export interface Offer {
  productId: string;
  /** גודל אריזה ביחידות בסיס; הכמות מעוגלת כלפי מעלה לכפולה שלו */
  packSize: number;
  minQuantity?: number;
  /** מחיר לפי מזהה מדרגה */
  prices: Record<string, TierPrice>;
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
  /** העלות החודשית הנוכחית של הלקוח, לחישוב חיסכון */
  currentCostAgorot?: number | null;
}

export interface PricedLine {
  productId: string;
  productName: string;
  quantity: number;
  billedQuantity: number;
  unitPriceAgorot: number;
  lineTotalAgorot: number;
  priceKind: PriceKind;
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
