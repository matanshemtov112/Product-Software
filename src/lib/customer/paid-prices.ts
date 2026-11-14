import type { PricedLine } from "@/lib/engine";
import { blockedReason, effectiveCost, type EffectiveCost, type SupplierTerms } from "./effective-cost";

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
  priceValidTo?: string;
  /** המחיר הרגיל האמיתי כשיש מבצע (מוצג עם קו) */
  regularUnitAgorot?: number;
  /** האריזה שנבחרה, והאריזות האחרות של הספק לאותו מוצר (טקסט לתצוגה) */
  packLabel?: string;
  otherPacks?: string[];
  /** המותג של ההצעה */
  brand?: string;
  /** שינוי אחרון במוצר: אריזה שהשתנתה או מוצר חלופי */
  changeNote?: string;
  /** מבצע כמות של הספק למוצר */
  deal?: PricedLine["deal"];
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
  productIds: string[];
  /** החיסכון האמיתי בחודש, אחרי משלוח ומינימום הזמנה */
  monthlySavingAgorot: number;
  /** פירוט העלות האפקטיבית אצל הספק */
  cost: EffectiveCost;
  /**
   * אם מעבירים את המוצרים, ההזמנה שנשארת אצל הספק הנוכחי יורדת מתחת למינימום שלו בסכום הזה בכל הזמנה.
   * 0 כשאין בעיה (או כשלא ידוע המינימום של הספק הנוכחי).
   */
  currentShortfallPerOrderAgorot: number;
}

export interface BlockedSaving extends SupplierSaving {
  /**
   * min-order: ההזמנה אצלו מתחת למינימום; delivery: המשלוח מבטל את החיסכון;
   * current-min: מה שנשאר אצל הספק הנוכחי יורד מתחת למינימום שלו
   */
  reason: "min-order" | "delivery" | "current-min";
}

export interface PaidComparison {
  lines: PaidComparisonLine[];
  /** ספקים שכדאי באמת לעבור אליהם (חיסכון אחרי משלוח ומינימום), מהחיסכון הגדול לקטן */
  suppliers: SupplierSaving[];
  /** ספקים זולים ליחידה שלא משתלמים בפועל, ולמה */
  blocked: BlockedSaving[];
  /** החיסכון האמיתי בחודש, כולל משלוח ומינימום הזמנה */
  monthlySavingAgorot: number;
}

export interface CompareContext {
  /** תנאי ההזמנה של כל ספק באזור של הלקוח */
  terms: Record<string, SupplierTerms>;
  deliveriesPerMonth: number;
  /** הספק שהלקוח כבר מזמין ממנו: בלי משלוח נוסף ובלי בעיית מינימום */
  currentSupplierId?: string | null;
}

const NO_TERMS: SupplierTerms = { minOrderAgorot: 0, feeAgorot: 0, freeAboveAgorot: null };

/**
 * משווה את המחירים שהלקוח משלם היום מול ההצעות במערכת לכל מוצר.
 * רק מוצרים שהלקוח מילא להם מחיר נכנסים להשוואה.
 * בשורה של כל מוצר החיסכון הוא לפי מחיר ליחידה. ברמת הספק החיסכון הוא אמיתי (עלות אפקטיבית):
 * כל ספק נבדק על כל המוצרים שזולים אצלו, עם המינימום והמשלוח שלו, והספק שחוסך הכי הרבה נבחר ראשון.
 */
export function comparePaidPrices(items: PaidItem[], offers: SystemOffer[], ctx?: CompareContext): PaidComparison {
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
  }

  // מה שעובר לספקים אחרים יוצא מההזמנה אצל הספק הנוכחי, שגם לה יש מינימום
  const current = ctx?.currentSupplierId ?? null;
  const currentMin = current ? (ctx?.terms[current]?.minOrderAgorot ?? 0) : 0;
  const deliveries = Math.max(1, ctx?.deliveriesPerMonth ?? 1);
  const movedAway = new Set<string>();
  const currentShortfall = (supplierId: string, moving: string[]) => {
    if (!currentMin || supplierId === current) return 0;
    const out = new Set([...movedAway, ...moving]);
    const remaining = Math.round(
      lines.filter((l) => !out.has(l.productId)).reduce((sum, l) => sum + l.paidAgorot * l.quantity, 0) / deliveries,
    );
    return remaining > 0 && remaining < currentMin ? currentMin - remaining : 0;
  };

  const evaluate = (supplierId: string, candidates: PaidComparisonLine[]): SupplierSaving | null => {
    const picked = candidates
      .map((l) => ({ line: l, offer: l.offers.find((o) => o.supplierId === supplierId) }))
      .filter((x): x is { line: PaidComparisonLine; offer: SystemOffer } => !!x.offer)
      .filter((x) => x.offer.unitPriceAgorot < x.line.paidAgorot);
    if (picked.length === 0) return null;
    const cost = effectiveCost(
      picked.map((x) => ({
        quantity: x.line.quantity,
        unitPriceAgorot: x.offer.unitPriceAgorot,
        paidAgorot: x.line.paidAgorot,
      })),
      ctx?.terms[supplierId] ?? NO_TERMS,
      ctx?.deliveriesPerMonth ?? 1,
      !ctx || ctx.currentSupplierId === supplierId,
    );
    return {
      supplierId,
      supplierName: picked[0].offer.supplierName,
      products: picked.map((x) => x.line.productName),
      productIds: picked.map((x) => x.line.productId),
      monthlySavingAgorot: Math.max(0, cost.netSavingAgorot),
      cost,
      currentShortfallPerOrderAgorot: currentShortfall(
        supplierId,
        picked.map((x) => x.line.productId),
      ),
    };
  };
  const worthIt = (s: SupplierSaving) => s.cost.worthIt && s.currentShortfallPerOrderAgorot === 0;

  // בחירה חמדנית: בכל סבב הספק שחוסך הכי הרבה על המוצרים שעוד לא שובצו
  const supplierIds = [...new Set(offers.map((o) => o.supplierId))];
  let open = lines.filter((l) => l.monthlySavingAgorot > 0);
  const suppliers: SupplierSaving[] = [];
  for (;;) {
    const options = supplierIds
      .map((id) => evaluate(id, open))
      .filter((s): s is SupplierSaving => !!s && worthIt(s))
      .sort((a, b) => b.cost.netSavingAgorot - a.cost.netSavingAgorot);
    if (options.length === 0) break;
    suppliers.push(options[0]);
    if (options[0].supplierId !== current) for (const id of options[0].productIds) movedAway.add(id);
    const taken = new Set(options[0].productIds);
    open = open.filter((l) => !taken.has(l.productId));
  }

  // זול ליחידה אצל ספק אחר, אבל לא משתלם (גם מוצרים שנשארו אצל הספק הנוכחי). מקובץ לפי הספק הזול לכל מוצר
  const blocked: BlockedSaving[] = [];
  const atCurrent = new Set(suppliers.filter((x) => x.supplierId === current).flatMap((x) => x.productIds));
  const unplaced = lines.filter(
    (l) =>
      l.monthlySavingAgorot > 0 && l.best!.supplierId !== current && (open.includes(l) || atCurrent.has(l.productId)),
  );
  for (const id of new Set(unplaced.map((l) => l.best!.supplierId))) {
    const s = evaluate(
      id,
      unplaced.filter((l) => l.best!.supplierId === id),
    );
    const reason = s && (blockedReason(s.cost) ?? (s.currentShortfallPerOrderAgorot > 0 ? "current-min" : null));
    if (s && reason) blocked.push({ ...s, reason });
  }

  lines.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot);
  return {
    lines,
    suppliers,
    blocked: blocked.sort((a, b) => b.cost.productSavingAgorot - a.cost.productSavingAgorot),
    monthlySavingAgorot: suppliers.reduce((sum, s) => sum + s.monthlySavingAgorot, 0),
  };
}
