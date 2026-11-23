import type { DemandKind } from "@prisma/client";
import { categoryTree, expandCategoryIds } from "@/lib/categories";
import { customerPoint } from "@/lib/coverage";
import { db } from "@/lib/db";
import { servesCustomer, type Circle, type Point } from "@/lib/geo";

/**
 * ביקוש באזור: אילו מוצרים עסקים באזור של הספק בדקו לאחרונה.
 *
 * פרטיות: הספק רואה רק סיכום מצטבר. מוצר מוצג רק כשלפחות MIN_BUSINESSES עסקים שונים בדקו אותו,
 * והמספר מוצג בטווח ("3-5 עסקים") ולא במדויק. אין שמות עסקים, כמויות, מחירים או פרטי חשבונית.
 */
export const WINDOW_DAYS = 14;
export const MIN_BUSINESSES = 3;
const DAY = 86_400_000;

const dayOf = (d: Date) => new Date(d.toISOString().slice(0, 10));

/** רושם שעסק התעניין במוצרים; פעם אחת לכל עסק, מוצר, סוג ויום */
export async function recordDemand(
  customerId: string,
  productIds: string[],
  kind: DemandKind,
  hasSupplier = false,
  now = new Date(),
) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return;
  await db.demandSignal.createMany({
    data: ids.map((productId) => ({ customerId, productId, kind, hasSupplier, day: dayOf(now) })),
    skipDuplicates: true,
  });
}

export type DemandLevel = "3-5" | "6-10" | "11-20" | "20+";

/** המספר המדויק לא נחשף: רק טווח */
export function demandLevel(businesses: number): DemandLevel | null {
  if (businesses < MIN_BUSINESSES) return null;
  if (businesses <= 5) return "3-5";
  if (businesses <= 10) return "6-10";
  if (businesses <= 20) return "11-20";
  return "20+";
}

export type Trend = "new" | "rising" | "steady";

export function demandTrend(current: number, previous: number): Trend {
  if (previous === 0) return "new";
  if (current >= previous * 1.5 && current - previous >= 2) return "rising";
  return "steady";
}

export interface DemandSignalRow {
  customerId: string;
  productId: string;
  hasSupplier: boolean;
  day: Date;
}

export interface CustomerPlace {
  id: string;
  regionId: string;
  point: Point | null;
}

export interface SupplierReach {
  id: string;
  areas: Circle[];
  regionIds: string[];
  /** המוצרים שהספק מוכר כרגע */
  productIds: Set<string>;
}

export interface DemandRow {
  productId: string;
  level: DemandLevel;
  trend: Trend;
  /** הספק כבר מוכר את המוצר */
  sells: boolean;
  /** לרוב העסקים שבדקו את המוצר יש לכל היותר ספק אחד אחר באזור שמוכר אותו */
  fewAlternatives: boolean;
  /** רוב העסקים כבר עובדים עם ספק ובודקים חלופה */
  seekingAlternative: boolean;
  /** לצורך מיון בלבד; לא מוצג לספק */
  score: number;
}

/**
 * מחשב את הביקוש באזור של ספק אחד (פונקציה טהורה, לבדיקות).
 * signals: אותות של 2 החלונות (הנוכחי והקודם). productFilter: המוצרים בתחומים של הספק (null = הכול).
 */
export function computeDemand(input: {
  supplier: SupplierReach;
  others: SupplierReach[];
  signals: DemandSignalRow[];
  customers: Map<string, CustomerPlace>;
  productFilter: Set<string> | null;
  now: Date;
}): DemandRow[] {
  const { supplier, others, signals, customers, productFilter, now } = input;
  const windowStart = now.getTime() - WINDOW_DAYS * DAY;
  const reach = (s: SupplierReach, c: CustomerPlace) =>
    servesCustomer({ areas: s.areas, regionIds: s.regionIds }, { regionId: c.regionId, point: c.point });

  const inArea = new Map<string, boolean>();
  const covered = (customerId: string) => {
    if (!inArea.has(customerId)) {
      const c = customers.get(customerId);
      inArea.set(customerId, Boolean(c && reach(supplier, c)));
    }
    return inArea.get(customerId)!;
  };

  const byProduct = new Map<string, { current: Set<string>; previous: Set<string>; hasSupplier: Set<string> }>();
  for (const s of signals) {
    if (productFilter && !productFilter.has(s.productId)) continue;
    if (!covered(s.customerId)) continue;
    const entry = byProduct.get(s.productId) ?? { current: new Set(), previous: new Set(), hasSupplier: new Set() };
    if (s.day.getTime() >= windowStart) {
      entry.current.add(s.customerId);
      if (s.hasSupplier) entry.hasSupplier.add(s.customerId);
    } else entry.previous.add(s.customerId);
    byProduct.set(s.productId, entry);
  }

  const rows: DemandRow[] = [];
  for (const [productId, e] of byProduct) {
    const level = demandLevel(e.current.size);
    if (!level) continue;
    // כמה ספקים אחרים שמוכרים את המוצר מגיעים לכל עסק
    let few = 0;
    for (const customerId of e.current) {
      const c = customers.get(customerId)!;
      const alternatives = others.filter((o) => o.productIds.has(productId) && reach(o, c)).length;
      if (alternatives <= 1) few++;
    }
    rows.push({
      productId,
      level,
      trend: demandTrend(e.current.size, e.previous.size),
      sells: supplier.productIds.has(productId),
      fewAlternatives: few * 2 > e.current.size,
      seekingAlternative: e.hasSupplier.size * 2 > e.current.size,
      score: e.current.size + (e.current.size - e.previous.size),
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

const reachSelect = {
  id: true,
  deliveryAreas: { select: { lat: true, lng: true, radiusKm: true } },
  deliveryZones: { select: { regionId: true } },
  offers: { where: { archivedAt: null, available: true }, select: { productId: true } },
} as const;

type ReachRecord = {
  id: string;
  deliveryAreas: Circle[];
  deliveryZones: { regionId: string }[];
  offers: { productId: string }[];
};

const toReach = (s: ReachRecord): SupplierReach => ({
  id: s.id,
  areas: s.deliveryAreas,
  regionIds: s.deliveryZones.map((z) => z.regionId),
  productIds: new Set(s.offers.map((o) => o.productId)),
});

export interface DemandProduct extends DemandRow {
  name: string;
  category: string;
  /** ההצעה של הספק למוצר, לקישור לעריכה */
  offerId: string | null;
}

/** הביקוש באזור של הספק, עם פרטי המוצרים, ממוין מהחזק לחלש */
export async function demandForSupplier(supplierId: string, now = new Date()): Promise<DemandProduct[]> {
  const since = dayOf(new Date(now.getTime() - 2 * WINDOW_DAYS * DAY));
  const [suppliers, signals, me] = await Promise.all([
    db.supplier.findMany({ where: { status: "APPROVED" }, select: reachSelect }),
    db.demandSignal.findMany({
      where: { day: { gte: since } },
      select: { customerId: true, productId: true, hasSupplier: true, day: true },
    }),
    db.supplier.findUnique({
      where: { id: supplierId },
      select: { allCategories: true, categories: { select: { categoryId: true } }, ...reachSelect },
    }),
  ]);
  if (!me || signals.length === 0) return [];

  // עסקים שחסמו את הספק לא נספרים אצלו
  const blocked = new Set(
    (await db.supplierBlock.findMany({ where: { supplierId, mode: "BLOCK" }, select: { customerId: true } })).map(
      (b) => b.customerId,
    ),
  );
  const customerRows = await db.customer.findMany({
    where: { id: { in: [...new Set(signals.map((s) => s.customerId))] } },
    select: { id: true, regionId: true, city: true, lat: true, lng: true },
  });
  const customers = new Map<string, CustomerPlace>();
  for (const c of customerRows) {
    if (blocked.has(c.id)) continue;
    customers.set(c.id, { id: c.id, regionId: c.regionId, point: await customerPoint(c) });
  }

  let productFilter: Set<string> | null = null;
  if (!me.allCategories) {
    const categoryIds = expandCategoryIds(
      await categoryTree(),
      me.categories.map((c) => c.categoryId),
    );
    const inDomain = await db.product.findMany({ where: { categoryId: { in: categoryIds } }, select: { id: true } });
    productFilter = new Set(inDomain.map((p) => p.id));
  }

  const rows = computeDemand({
    supplier: toReach(me),
    others: suppliers.filter((s) => s.id !== supplierId).map(toReach),
    signals,
    customers,
    productFilter,
    now,
  });
  if (rows.length === 0) return [];
  const [products, offers] = await Promise.all([
    db.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) } },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    db.supplierOffer.findMany({
      where: { supplierId, archivedAt: null, productId: { in: rows.map((r) => r.productId) } },
      select: { id: true, productId: true },
    }),
  ]);
  const product = new Map(products.map((p) => [p.id, p]));
  const offer = new Map<string, string>();
  for (const o of offers) if (!offer.has(o.productId)) offer.set(o.productId, o.id);
  return rows.flatMap((r) => {
    const p = product.get(r.productId);
    return p ? [{ ...r, name: p.name, category: p.category.name, offerId: offer.get(r.productId) ?? null }] : [];
  });
}
