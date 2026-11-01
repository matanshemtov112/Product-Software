/**
 * הדוח החודשי של הלקוח: מה בדקנו בשבילו בחודש, מה השתנה במחירים, כמה אפשר לחסוך וכמה כבר חסך.
 * החישוב כאן טהור; הטעינה מהמסד ב-monthly-report-load.ts.
 * המחירים הם מחירי המחירון הבסיסי של כל ספק (המדרגה הראשונה), ללא מע״מ.
 */

const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export interface ReportMonth {
  /** למשל "2026-10" */
  key: string;
  label: string;
  /** תחילת החודש */
  start: Date;
  /** תחילת החודש הבא, או עכשיו לחודש הנוכחי */
  end: Date;
  /** החודש עוד לא נגמר */
  partial: boolean;
}

const keyOf = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

export function reportMonth(key: string, now = new Date()): ReportMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  if (m < 0 || m > 11) return null;
  const start = new Date(y, m, 1);
  if (start > now) return null;
  const next = new Date(y, m + 1, 1);
  const partial = next > now;
  return { key: keyOf(y, m), label: `${MONTH_NAMES[m]} ${y}`, start, end: partial ? now : next, partial };
}

/** החודשים שיש להם דוח: מהחודש שבו הלקוח נרשם ועד החודש הנוכחי, מהחדש לישן */
export function reportMonths(since: Date, now = new Date()): ReportMonth[] {
  const out: ReportMonth[] = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  const first = since.getFullYear() * 12 + since.getMonth();
  while (y * 12 + m >= first && out.length < 36) {
    out.push(reportMonth(keyOf(y, m), now)!);
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
  }
  return out;
}

/** החודש הקודם (שהסתיים), או null אם הלקוח נרשם החודש */
export function lastFullMonth(since: Date, now = new Date()) {
  return reportMonths(since, now).find((m) => !m.partial) ?? null;
}

export interface PricePoint {
  supplierId: string;
  productId: string;
  unitPriceAgorot: number;
  kind: "REGULAR" | "PROMOTION";
  validFrom: Date;
  validTo: Date | null;
}

/**
 * המחיר של ספק למוצר ברגע מסוים: המחיר הרגיל העדכני ביותר שכבר נכנס לתוקף,
 * או מבצע בתוקף אם הוא זול יותר (כמו בהשוואה עצמה).
 */
export function priceAt(points: PricePoint[], at: Date): number | null {
  let regular: PricePoint | null = null;
  let promo: number | null = null;
  for (const p of points) {
    if (p.validFrom > at || (p.validTo && p.validTo <= at)) continue;
    if (p.kind === "PROMOTION") promo = promo === null ? p.unitPriceAgorot : Math.min(promo, p.unitPriceAgorot);
    else if (!regular || p.validFrom > regular.validFrom) regular = p;
  }
  if (regular === null) return promo;
  return promo !== null && promo < regular.unitPriceAgorot ? promo : regular.unitPriceAgorot;
}

export interface WatchedProduct {
  productId: string;
  productName: string;
  unitLabel: string;
  monthlyQuantity: number;
  /** המחיר ליחידה שהלקוח משלם היום; null כשלא מילא */
  paidAgorot: number | null;
  /** הספק הנוכחי, אם רשום במערכת */
  currentSupplierId: string | null;
}

export interface AcceptedLine {
  productName: string;
  unitLabel: string;
  supplierName: string;
  monthlyQuantity: number;
  beforeAgorot: number;
  afterAgorot: number;
  decidedAt: Date;
}

export interface ReportInput {
  month: ReportMonth;
  products: WatchedProduct[];
  /** מחירי המחירון הבסיסי של ספקים שמספקים לאזור של הלקוח */
  prices: PricePoint[];
  supplierNames: Record<string, string>;
  accepted: AcceptedLine[];
  /** כמה בדיקות סל הלקוח הריץ בחודש */
  checks: number;
  /** כמה התראות על מחירים קיבל בחודש */
  alerts: number;
}

export interface PriceMove {
  productName: string;
  unitLabel: string;
  supplierName: string;
  beforeAgorot: number;
  afterAgorot: number;
  /** ההשפעה על החשבון החודשי של הלקוח (חיובי = יותר יקר) */
  monthlyImpactAgorot: number;
}

export interface Opportunity {
  productName: string;
  unitLabel: string;
  supplierName: string;
  paidAgorot: number;
  bestAgorot: number;
  monthlySavingAgorot: number;
}

export interface MonthlyReport {
  month: ReportMonth;
  productsChecked: number;
  suppliersCompared: number;
  checks: number;
  alerts: number;
  /** שינויים במחיר אצל הספקים הנוכחיים של הלקוח */
  increases: PriceMove[];
  decreases: PriceMove[];
  /** המחיר הזול ביותר בשוק למוצר עלה או ירד */
  marketMoves: PriceMove[];
  opportunities: Opportunity[];
  potentialSavingAgorot: number;
  accepted: AcceptedLine[];
  actualSavingAgorot: number;
}

const impact = (before: number, after: number, quantity: number) => Math.round((after - before) * quantity);

export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const { month, products, prices, supplierNames } = input;
  const bySupplierProduct = new Map<string, PricePoint[]>();
  const suppliersByProduct = new Map<string, Set<string>>();
  for (const p of prices) {
    const k = `${p.supplierId}:${p.productId}`;
    bySupplierProduct.set(k, [...(bySupplierProduct.get(k) ?? []), p]);
    suppliersByProduct.set(p.productId, (suppliersByProduct.get(p.productId) ?? new Set()).add(p.supplierId));
  }
  const at = (supplierId: string, productId: string, t: Date) =>
    priceAt(bySupplierProduct.get(`${supplierId}:${productId}`) ?? [], t);
  // ברגע שלפני תחילת החודש, ובסוף החודש
  const before = new Date(month.start.getTime() - 1);
  const after = month.end;

  const lowest = (productId: string, t: Date) => {
    let best: { supplierId: string; price: number } | null = null;
    for (const s of suppliersByProduct.get(productId) ?? []) {
      const price = at(s, productId, t);
      if (price !== null && (!best || price < best.price)) best = { supplierId: s, price };
    }
    return best;
  };

  const increases: PriceMove[] = [];
  const decreases: PriceMove[] = [];
  const marketMoves: PriceMove[] = [];
  const opportunities: Opportunity[] = [];
  const compared = new Set<string>();

  for (const p of products) {
    for (const s of suppliersByProduct.get(p.productId) ?? []) compared.add(s);
    const base = { productName: p.productName, unitLabel: p.unitLabel };

    if (p.currentSupplierId) {
      const from = at(p.currentSupplierId, p.productId, before);
      const to = at(p.currentSupplierId, p.productId, after);
      if (from !== null && to !== null && from !== to) {
        const move = {
          ...base,
          supplierName: supplierNames[p.currentSupplierId] ?? "",
          beforeAgorot: from,
          afterAgorot: to,
          monthlyImpactAgorot: impact(from, to, p.monthlyQuantity),
        };
        (to > from ? increases : decreases).push(move);
      }
    }

    const low0 = lowest(p.productId, before);
    const low1 = lowest(p.productId, after);
    if (low0 && low1 && low0.price !== low1.price) {
      marketMoves.push({
        ...base,
        supplierName: supplierNames[low1.supplierId] ?? "",
        beforeAgorot: low0.price,
        afterAgorot: low1.price,
        monthlyImpactAgorot: impact(low0.price, low1.price, p.monthlyQuantity),
      });
    }

    if (p.paidAgorot !== null && low1 && low1.supplierId !== p.currentSupplierId && low1.price < p.paidAgorot) {
      opportunities.push({
        ...base,
        supplierName: supplierNames[low1.supplierId] ?? "",
        paidAgorot: p.paidAgorot,
        bestAgorot: low1.price,
        monthlySavingAgorot: Math.round((p.paidAgorot - low1.price) * p.monthlyQuantity),
      });
    }
  }

  const byImpact = (a: PriceMove, b: PriceMove) => Math.abs(b.monthlyImpactAgorot) - Math.abs(a.monthlyImpactAgorot);
  const accepted = input.accepted
    .filter((l) => l.decidedAt >= month.start && l.decidedAt < (month.partial ? new Date(8.64e15) : month.end))
    .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime());
  return {
    month,
    productsChecked: products.length,
    suppliersCompared: compared.size,
    checks: input.checks,
    alerts: input.alerts,
    increases: increases.sort(byImpact),
    decreases: decreases.sort(byImpact),
    marketMoves: marketMoves.sort(byImpact),
    opportunities: opportunities.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot),
    potentialSavingAgorot: opportunities.reduce((s, o) => s + o.monthlySavingAgorot, 0),
    accepted,
    actualSavingAgorot: accepted.reduce(
      (s, l) => s + Math.max(0, Math.round((l.beforeAgorot - l.afterAgorot) * l.monthlyQuantity)),
      0,
    ),
  };
}
