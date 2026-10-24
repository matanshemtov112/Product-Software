import type {
  BasketLine,
  EngineOptions,
  EngineResult,
  Offer,
  Plan,
  Preference,
  PricedLine,
  SupplierInput,
  SupplierShare,
  TierPrice,
} from "./types";

export const PREFERENCE_WEIGHTS: Record<Preference, { price: number; service: number; reliability: number }> = {
  PRICE: { price: 1, service: 0, reliability: 0 },
  BALANCED: { price: 0.6, service: 0.2, reliability: 0.2 },
  SERVICE: { price: 0.4, service: 0.3, reliability: 0.3 },
};

/** קנס על כל ספק נוסף בצירוף: עוד קבלה, עוד חשבונית */
export const EXTRA_SUPPLIER_PENALTY = 0.02;

const MAX_TIER_ITERATIONS = 10;

/** מעל מספר זה של ספקים רלוונטיים בודקים רק את המבטיחים ביותר, כדי שהחישוב יישאר מתחת לשנייה */
const MAX_CANDIDATES = 20;

/** הכמות לחיוב: לפחות המינימום, מעוגלת כלפי מעלה לגודל האריזה */
export function billedQuantity(offer: Offer, quantity: number): number {
  const wanted = Math.max(quantity, offer.minQuantity ?? 0);
  if (offer.packSize <= 0) return wanted;
  const packs = Math.ceil(wanted / offer.packSize - 1e-9);
  return Math.round(packs * offer.packSize * 1000) / 1000;
}

/** המחיר במדרגה, או במדרגה הנמוכה הקרובה שיש לה מחיר */
export function priceAtTier(supplier: SupplierInput, offer: Offer, tierIndex: number): TierPrice | null {
  for (let i = tierIndex; i >= 0; i--) {
    const price = offer.prices[supplier.tiers[i].id];
    if (price) return price;
  }
  return null;
}

interface Prepared {
  supplier: SupplierInput;
  offers: Map<string, Offer>;
  /** מחיר השורה לפי מוצר ומדרגה; מחושב פעם אחת לכל ריצה */
  cache: Map<string, (PricedLine | null)[]>;
}

function prepare(supplier: SupplierInput): Prepared {
  const tiers = [...supplier.tiers].sort((a, b) => a.minMonthlyAgorot - b.minMonthlyAgorot);
  const sorted = { ...supplier, tiers };
  return { supplier: sorted, offers: new Map(supplier.offers.map((o) => [o.productId, o])), cache: new Map() };
}

function lineAt(p: Prepared, line: BasketLine, tierIndex: number): PricedLine | null {
  let perTier = p.cache.get(line.productId);
  if (!perTier) {
    perTier = p.supplier.tiers.map((_, t) => priceLine(p, line, t));
    p.cache.set(line.productId, perTier);
  }
  return perTier[tierIndex] ?? null;
}

function priceLine(p: Prepared, line: BasketLine, tierIndex: number): PricedLine | null {
  if (line.excludedSupplierIds?.includes(p.supplier.id)) return null;
  const offer = p.offers.get(line.productId);
  if (!offer) return null;
  const price = priceAtTier(p.supplier, offer, tierIndex);
  if (!price) return null;
  const billed = billedQuantity(offer, line.quantity);
  return {
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    billedQuantity: billed,
    unitPriceAgorot: price.unitPriceAgorot,
    lineTotalAgorot: Math.round(billed * price.unitPriceAgorot),
    priceKind: price.kind,
  };
}

/** המדרגה הגבוהה ביותר שההיקף אצל הספק, לפי מחירי אותה מדרגה, עומד בסף שלה */
function tierFor(p: Prepared, lines: BasketLine[]): number {
  for (let t = p.supplier.tiers.length - 1; t > 0; t--) {
    let spend = 0;
    for (const line of lines) spend += lineAt(p, line, t)?.lineTotalAgorot ?? 0;
    if (spend >= p.supplier.tiers[t].minMonthlyAgorot) return t;
  }
  return 0;
}

interface Assignment {
  bySupplier: Map<string, BasketLine[]>;
  missing: string[];
}

function assign(
  subset: Prepared[],
  lines: BasketLine[],
  tiers: Map<string, number>,
  forced: Map<string, string>,
): Assignment {
  const bySupplier = new Map<string, BasketLine[]>(subset.map((p) => [p.supplier.id, []]));
  const missing: string[] = [];
  for (const line of lines) {
    const forcedId = forced.get(line.productId);
    let best: { id: string; cost: number } | null = null;
    for (const p of subset) {
      if (forcedId && p.supplier.id !== forcedId) continue;
      const priced = lineAt(p, line, tiers.get(p.supplier.id)!);
      if (priced && (!best || priced.lineTotalAgorot < best.cost)) {
        best = { id: p.supplier.id, cost: priced.lineTotalAgorot };
      }
    }
    if (best) bySupplier.get(best.id)!.push(line);
    else missing.push(line.productId);
  }
  return { bySupplier, missing };
}

/** מחשב את התוכנית לצירוף ספקים אחד, או null אם הצירוף לא אפשרי */
function evaluateSubset(subset: Prepared[], lines: BasketLine[], opts: EngineOptions): Plan | null {
  const deliveries = Math.max(1, opts.deliveriesPerMonth);
  const forced = new Map<string, string>();

  for (let guard = 0; guard <= lines.length; guard++) {
    // קביעת מדרגות: חוזרים עד שהשיבוץ והמדרגות מתייצבים
    let tiers = new Map(subset.map((p) => [p.supplier.id, 0]));
    let assignment = assign(subset, lines, tiers, forced);
    for (let i = 0; i < MAX_TIER_ITERATIONS; i++) {
      const next = new Map(subset.map((p) => [p.supplier.id, tierFor(p, assignment.bySupplier.get(p.supplier.id)!)]));
      if ([...next].every(([id, t]) => tiers.get(id) === t)) break;
      tiers = next;
      assignment = assign(subset, lines, tiers, forced);
    }
    // שיבוץ מחדש יכול להוריד ספק מתחת לסף המדרגה שלו; מורידים מדרגה עד שזה תקין
    for (const p of subset) {
      const own = assignment.bySupplier.get(p.supplier.id)!;
      tiers.set(p.supplier.id, Math.min(tiers.get(p.supplier.id)!, tierFor(p, own)));
    }

    const shares: SupplierShare[] = [];
    let violator: Prepared | null = null;
    for (const p of subset) {
      const own = assignment.bySupplier.get(p.supplier.id)!;
      if (own.length === 0) return null; // צירוף קטן יותר כבר מכסה את המקרה
      const tierIndex = tiers.get(p.supplier.id)!;
      const priced = own.map((l) => lineAt(p, l, tierIndex)!);
      const productsAgorot = priced.reduce((s, l) => s + l.lineTotalAgorot, 0);
      const perDelivery = productsAgorot / deliveries;
      if (perDelivery < p.supplier.minOrderAgorot) {
        violator = p;
        break;
      }
      const { feeAgorot, freeAboveAgorot } = p.supplier.delivery;
      const free = freeAboveAgorot !== null && perDelivery >= freeAboveAgorot;
      const deliveryAgorot = free ? 0 : feeAgorot * deliveries;
      shares.push({
        supplierId: p.supplier.id,
        supplierName: p.supplier.name,
        tierName: p.supplier.tiers[tierIndex]?.name ?? "",
        lines: priced,
        productsAgorot,
        deliveryAgorot,
        totalAgorot: productsAgorot + deliveryAgorot,
      });
    }

    if (!violator) {
      const productsAgorot = shares.reduce((s, x) => s + x.productsAgorot, 0);
      const deliveryAgorot = shares.reduce((s, x) => s + x.deliveryAgorot, 0);
      return {
        suppliers: shares,
        productsAgorot,
        deliveryAgorot,
        totalAgorot: productsAgorot + deliveryAgorot,
        missingProductIds: assignment.missing,
        score: 0,
        explanation: [],
      };
    }

    // ספק מתחת למינימום הזמנה: מעבירים אליו את הפריט שההעברה שלו הכי זולה
    const v: Prepared = violator;
    let cheapest: { productId: string; delta: number } | null = null;
    for (const p of subset) {
      if (p === v) continue;
      for (const line of assignment.bySupplier.get(p.supplier.id)!) {
        if (forced.has(line.productId)) continue;
        const here = lineAt(v, line, tiers.get(v.supplier.id)!);
        const there = lineAt(p, line, tiers.get(p.supplier.id)!);
        if (!here || !there) continue;
        const delta = here.lineTotalAgorot - there.lineTotalAgorot;
        if (!cheapest || delta < cheapest.delta) cheapest = { productId: line.productId, delta };
      }
    }
    if (!cheapest) return null;
    forced.set(cheapest.productId, v.supplier.id);
  }
  return null;
}

/**
 * מדרג ספקים לפי כמה מהסל הם מכסים ובאיזה מחיר יחסית לזול ביותר,
 * ומשאיר את המובילים. ספק שמכסה פריט שאיש אחר לא מכסה נשאר תמיד.
 */
function shortlist(candidates: Prepared[], lines: BasketLine[], limit: number): Prepared[] {
  if (candidates.length <= limit) return candidates;
  const top = (p: Prepared) => p.supplier.tiers.length - 1;
  const best = new Map<string, number>();
  const sellers = new Map<string, number>();
  for (const line of lines) {
    for (const p of candidates) {
      const priced = lineAt(p, line, top(p));
      if (!priced) continue;
      sellers.set(line.productId, (sellers.get(line.productId) ?? 0) + 1);
      const b = best.get(line.productId);
      if (b === undefined || priced.lineTotalAgorot < b) best.set(line.productId, priced.lineTotalAgorot);
    }
  }
  const ranked = candidates.map((p) => {
    let value = 0;
    let unique = false;
    for (const line of lines) {
      const priced = lineAt(p, line, top(p));
      if (!priced) continue;
      value += (best.get(line.productId)! || 1) / (priced.lineTotalAgorot || 1);
      if (sellers.get(line.productId) === 1) unique = true;
    }
    return { p, value, unique };
  });
  ranked.sort((a, b) => Number(b.unique) - Number(a.unique) || b.value - a.value);
  return ranked.slice(0, Math.max(limit, ranked.filter((r) => r.unique).length)).map((r) => r.p);
}

function* combinations<T>(items: T[], size: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === size) {
    yield acc;
    return;
  }
  for (let i = start; i < items.length; i++) yield* combinations(items, size, i + 1, [...acc, items[i]]);
}

function weighted(plan: Plan, value: (s: SupplierInput) => number, byId: Map<string, SupplierInput>): number {
  const total = plan.productsAgorot || 1;
  return plan.suppliers.reduce((sum, s) => sum + value(byId.get(s.supplierId)!) * (s.productsAgorot / total), 0);
}

const shekel = (agorot: number) =>
  `₪${(agorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

function scoreAndExplain(
  plan: Plan,
  minCost: number,
  opts: EngineOptions,
  byId: Map<string, SupplierInput>,
): void {
  const w = PREFERENCE_WEIGHTS[opts.preference];
  const neutral = opts.neutralRating ?? 4;
  const rating = weighted(plan, (s) => s.rating ?? neutral, byId);
  const reliability = weighted(plan, (s) => s.reliability, byId);
  plan.score =
    w.price * (minCost / plan.totalAgorot) +
    w.service * (rating / 5) +
    w.reliability * reliability -
    EXTRA_SUPPLIER_PENALTY * (plan.suppliers.length - 1);

  const names = plan.suppliers.map((s) => s.supplierName).join(", ");
  plan.explanation = [
    `${plan.suppliers.length === 1 ? "ספק" : "ספקים"}: ${names}`,
    `מוצרים ${shekel(plan.productsAgorot)}, משלוחים ${shekel(plan.deliveryAgorot)}, סה״כ ${shekel(plan.totalAgorot)} לחודש`,
    `דירוג משוקלל ${rating.toFixed(1)}/5, אמינות ${Math.round(reliability * 100)}%`,
  ];
  const gap = plan.totalAgorot - minCost;
  if (gap > 0) plan.explanation.push(`יקר ב-${shekel(gap)} מהאפשרות הזולה ביותר`);
  const promos = plan.suppliers.flatMap((s) => s.lines).filter((l) => l.priceKind === "PROMOTION").length;
  if (promos > 0) plan.explanation.push(`${promos} פריטים במחיר מבצע`);
  if (plan.missingProductIds.length > 0) plan.explanation.push(`חסרים ${plan.missingProductIds.length} פריטים`);
}

function pickBest(plans: Plan[], better: (a: Plan, b: Plan) => boolean): Plan | null {
  let best: Plan | null = null;
  for (const p of plans) if (!best || better(p, best)) best = p;
  return best;
}

export function optimizeBasket(lines: BasketLine[], suppliers: SupplierInput[], opts: EngineOptions): EngineResult {
  const empty: EngineResult = {
    lowestCost: null,
    singleSupplier: null,
    recommended: null,
    monthlySavingsAgorot: null,
    annualSavingsAgorot: null,
    evaluatedCombinations: 0,
  };
  const wanted = lines.filter((l) => l.quantity > 0);
  if (wanted.length === 0) return empty;

  const ids = new Set(wanted.map((l) => l.productId));
  const eligible = shortlist(
    suppliers.map(prepare).filter((p) => [...p.offers.keys()].some((id) => ids.has(id))),
    wanted,
    opts.maxCandidates ?? MAX_CANDIDATES,
  );
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const maxSize = Math.min(opts.maxSuppliers ?? 4, eligible.length);

  const plans: Plan[] = [];
  let evaluated = 0;
  for (let size = 1; size <= maxSize; size++) {
    for (const subset of combinations(eligible, size)) {
      evaluated++;
      const plan = evaluateSubset(subset, wanted, opts);
      if (plan) plans.push(plan);
    }
  }
  if (plans.length === 0) return { ...empty, evaluatedCombinations: evaluated };

  // משווים קודם תוכניות שמכסות את כל הסל; אם אין כאלה, את אלה שחסר בהן הכי מעט
  const fewestMissing = Math.min(...plans.map((p) => p.missingProductIds.length));
  const comparable = plans.filter((p) => p.missingProductIds.length === fewestMissing);
  const lowestCost = pickBest(comparable, (a, b) => a.totalAgorot < b.totalAgorot)!;
  for (const p of plans) scoreAndExplain(p, lowestCost.totalAgorot, opts, byId);

  // "מחיר קודם" פירושו תמיד הזול ביותר (סעיף 12 באפיון)
  const recommended =
    opts.preference === "PRICE" ? lowestCost : pickBest(comparable, (a, b) => a.score > b.score)!;
  const singles = plans.filter((p) => p.suppliers.length === 1);
  const singleFewest = singles.length ? Math.min(...singles.map((p) => p.missingProductIds.length)) : 0;
  const singleSupplier = pickBest(
    singles.filter((p) => p.missingProductIds.length === singleFewest),
    (a, b) => a.score > b.score,
  );

  const current = opts.currentCostAgorot ?? null;
  const monthly = current !== null && fewestMissing === 0 ? current - recommended.totalAgorot : null;
  return {
    lowestCost,
    singleSupplier,
    recommended,
    monthlySavingsAgorot: monthly,
    annualSavingsAgorot: monthly === null ? null : monthly * 12,
    evaluatedCombinations: evaluated,
  };
}
