import { redirect } from "next/navigation";
import type { Unit } from "@prisma/client";
import { db } from "@/lib/db";
import { comparePaidPrices, type PaidComparison } from "./paid-prices";
import { pricedPerPack, packPriceLabel } from "@/lib/pack";
import { dealLabel } from "@/lib/deal-label";
import { shekels, UNIT_LABEL } from "@/lib/format";
import type { PricedLine } from "@/lib/engine";
import {
  optimizeBasket,
  priceLineAt,
  quoteForSupplier,
  sameBrand,
  type BasketLine,
  type EngineOptions,
  type EngineResult,
  type SupplierInput,
  type SupplierQuote,
} from "@/lib/engine";
import { loadEngineInput } from "@/lib/engine/load";
import type { QuoteSnapshot } from "@/lib/inquiries";

/** הלקוח של המשתמש המחובר, עם האזור שלו */
export async function customerForUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { customer: { include: { region: true } } },
  });
  // משתמש שהמנהל הסיר מהצוות חוזר להתחברות
  if (!user) redirect("/login");
  if (!user.customer) throw new Error("User is not linked to a customer");
  return user.customer;
}

/** סל של הלקוח, או null אם הסל לא שלו */
export async function getBasket(customerId: string, basketId: string) {
  return db.basket.findFirst({
    where: { id: basketId, customerId },
    include: {
      items: { include: { product: { include: { category: true } } }, orderBy: { product: { name: "asc" } } },
      currentSupplier: { select: { id: true, companyName: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export interface QuoteRow {
  supplierId: string;
  supplierName: string;
  quote: SupplierQuote;
  snapshot: QuoteSnapshot;
  /** סוגי המוצרים מהסל שהספק מכסה */
  categories: string[];
  supplier: SupplierInput;
}

export interface BasketAnalysis {
  result: EngineResult;
  /** ההצעה של כל ספק רלוונטי, מהקטן לגדול לפי הפער */
  rows: QuoteRow[];
  lineCount: number;
  /** פי כמה היקף הרכש המוצהר גדול מהסל (1 אם לא הוצהר או קטן ממנו) */
  volumeScale: number;
  /** מוצרים שהלקוח ביקש במותג מסוים: המחיר הזול באותו מותג, ומוצר דומה זול יותר ממותג אחר אם יש */
  brandChoices: BrandChoice[];
}

export interface BrandOffer {
  supplierId: string;
  supplierName: string;
  brand?: string;
  unitPriceAgorot: number;
}

export interface BrandChoice {
  productId: string;
  productName: string;
  unit: Unit;
  quantity: number;
  /** המותג שהלקוח ביקש */
  brand: string;
  /** ההצעה הזולה באותו מותג בדיוק; null אם אף ספק לא מוכר את המותג */
  exact: BrandOffer | null;
  /** מוצר דומה ממותג אחר שזול יותר מהמותג המבוקש (או היחיד שיש); null אם אין */
  similar: BrandOffer | null;
  /** כמה המוצר הדומה חוסך בחודש מול המותג המבוקש; null כשאין מחיר למותג המבוקש */
  similarSavingAgorot: number | null;
}

/** מריץ את המנוע על סל: שלוש האפשרויות, וההצעה של כל ספק מול החלופה הזולה לאותם מוצרים */
export async function analyzeBasket(basketId: string): Promise<BasketAnalysis> {
  const { basket, lines, suppliers, options } = await loadEngineInput(basketId);
  const result = optimizeBasket(lines, suppliers, options);
  const units = new Map(basket.items.map((i) => [i.productId, i.product.unit]));
  const names = new Map(lines.map((l) => [l.productId, l.productName]));
  const categoryOf = new Map(basket.items.map((i) => [i.productId, i.product.category.name]));
  const paid = new Map(basket.items.map((i) => [i.productId, i.currentUnitPriceAgorot]));
  const rows: QuoteRow[] = [];
  for (const s of suppliers) {
    const quote = quoteForSupplier(lines, suppliers, options, s.id);
    if (!quote) continue;
    rows.push({
      supplierId: s.id,
      supplierName: s.name,
      quote,
      snapshot: snapshot(quote, units, names, paid, s),
      categories: [...new Set(quote.share.lines.map((l) => categoryOf.get(l.productId) ?? ""))].filter(Boolean),
      supplier: s,
    });
  }
  rows.sort((a, b) => a.quote.gapAgorot - b.quote.gapAgorot || a.quote.share.totalAgorot - b.quote.share.totalAgorot);
  return {
    result,
    rows,
    lineCount: lines.filter((l) => l.quantity > 0).length,
    volumeScale: options.volumeScale ?? 1,
    brandChoices: brandChoices(lines, suppliers, options, rows, units),
  };
}

/**
 * לכל מוצר שהלקוח ביקש במותג מסוים: ההצעה הזולה באותו מותג (מההצעות של הספקים בניתוח),
 * ומוצר דומה ממותג אחר שזול ממנה, במדרגה שהלקוח מקבל אצל אותו ספק.
 */
export function brandChoices(
  lines: BasketLine[],
  suppliers: SupplierInput[],
  options: EngineOptions,
  rows: Pick<QuoteRow, "supplierId" | "supplierName" | "quote">[],
  units: Map<string, Unit>,
): BrandChoice[] {
  const choices: BrandChoice[] = [];
  for (const line of lines) {
    if (!line.brand || line.quantity <= 0) continue;
    let exact: BrandOffer | null = null;
    for (const r of rows) {
      const l = r.quote.share.lines.find((x) => x.productId === line.productId);
      if (l && (!exact || l.unitPriceAgorot < exact.unitPriceAgorot)) {
        exact = {
          supplierId: r.supplierId,
          supplierName: r.supplierName,
          brand: l.brand,
          unitPriceAgorot: l.unitPriceAgorot,
        };
      }
    }
    let similar: BrandOffer | null = null;
    const anyBrand = { ...line, brand: undefined };
    for (const s of suppliers) {
      const tierName = rows.find((r) => r.supplierId === s.id)?.quote.share.tierName;
      const priced = priceLineAt(s, anyBrand, tierName, options.deliveriesPerMonth);
      if (!priced || sameBrand(priced.brand, line.brand)) {
        // הזולה אצל הספק היא מהמותג המבוקש; בודקים אם יש לו גם אריזה ממותג אחר
        const others = s.offers.filter((o) => o.productId === line.productId && !sameBrand(o.brand, line.brand));
        if (!priced || others.length === 0) continue;
        const other = priceLineAt({ ...s, offers: others }, anyBrand, tierName, options.deliveriesPerMonth);
        if (other && (!similar || other.unitPriceAgorot < similar.unitPriceAgorot)) {
          similar = {
            supplierId: s.id,
            supplierName: s.name,
            brand: other.brand,
            unitPriceAgorot: other.unitPriceAgorot,
          };
        }
        continue;
      }
      if (!similar || priced.unitPriceAgorot < similar.unitPriceAgorot) {
        similar = {
          supplierId: s.id,
          supplierName: s.name,
          brand: priced.brand,
          unitPriceAgorot: priced.unitPriceAgorot,
        };
      }
    }
    if (similar && exact && similar.unitPriceAgorot >= exact.unitPriceAgorot) similar = null;
    if (!exact && !similar) continue;
    choices.push({
      productId: line.productId,
      productName: line.productName,
      unit: units.get(line.productId) ?? "UNIT",
      quantity: line.quantity,
      brand: line.brand,
      exact,
      similar,
      similarSavingAgorot:
        similar && exact ? Math.round((exact.unitPriceAgorot - similar.unitPriceAgorot) * line.quantity) : null,
    });
  }
  return choices;
}

function packPriceFor(unitPriceAgorot: number, pack: SupplierInput["offers"][number]["packInfo"]) {
  return pack && pricedPerPack(pack) ? packPriceLabel(unitPriceAgorot, pack) : undefined;
}

function snapshot(
  quote: SupplierQuote,
  units: Map<string, Unit>,
  names: Map<string, string>,
  paid: Map<string, number | null>,
  supplier: SupplierInput,
): QuoteSnapshot {
  const { share } = quote;
  // האריזה שנבחרה לכל שורה (ספק יכול למכור מוצר בכמה אריזות)
  const byOffer = new Map(supplier.offers.map((o) => [o.offerId ?? o.productId, o]));
  const offerOf = (l: { offerId?: string; productId: string }) =>
    byOffer.get(l.offerId ?? l.productId) ?? supplier.offers.find((o) => o.productId === l.productId);
  return {
    tierName: share.tierName,
    lines: share.lines.map((l) => ({
      productName: l.productName,
      unit: units.get(l.productId) ?? "UNIT",
      quantity: l.quantity,
      billedQuantity: l.billedQuantity,
      unitPriceAgorot: l.unitPriceAgorot,
      lineTotalAgorot: l.lineTotalAgorot,
      customerPaidAgorot: paid.get(l.productId) ?? null,
      pack: offerOf(l)?.packLabel,
      brand: l.brand,
      otherPacks: otherPacksText(l, units.get(l.productId) ?? "UNIT"),
      minOrder: offerOf(l)?.minOrderLabel,
      packPrice: packPriceFor(l.unitPriceAgorot, offerOf(l)?.packInfo),
      priceKind: l.priceKind,
      priceUpdatedAt: l.priceUpdatedAt,
      priceValidTo: l.priceValidTo,
      regularUnitAgorot: l.regularUnitAgorot,
      deal: l.deal
        ? `${dealLabel(l.deal, UNIT_LABEL[units.get(l.productId) ?? "UNIT"])}${l.deal.applied ? " (חל)" : ""}`
        : undefined,
    })),
    productsAgorot: share.productsAgorot,
    deliveryAgorot: share.deliveryAgorot,
    totalAgorot: share.totalAgorot,
    missingProducts: quote.missingProductIds.map((id) => names.get(id) ?? id),
  };
}

/** המחירים שהלקוח משלם היום בסל מול ההצעות במערכת לכל מוצר, לפי ההצעה של כל ספק בניתוח */
export function paidComparison(
  basket: {
    deliveriesPerMonth: number;
    currentSupplierId: string | null;
    items: {
      productId: string;
      monthlyQuantity: number;
      currentUnitPriceAgorot: number | null;
      product: { name: string; unit: Unit };
    }[];
  },
  analysis: BasketAnalysis,
): PaidComparison {
  const unitOf = new Map(basket.items.map((i) => [i.productId, i.product.unit]));
  return comparePaidPrices(
    basket.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      unit: i.product.unit,
      quantity: i.monthlyQuantity,
      paidAgorot: i.currentUnitPriceAgorot,
    })),
    analysis.rows.flatMap((r) =>
      r.quote.share.lines.map((l) => ({
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        productId: l.productId,
        unitPriceAgorot: l.unitPriceAgorot,
        priceKind: l.priceKind,
        priceUpdatedAt: l.priceUpdatedAt,
        priceValidTo: l.priceValidTo,
        regularUnitAgorot: l.regularUnitAgorot,
        packLabel: l.packLabel,
        brand: l.brand,
        otherPacks: otherPacksText(l, unitOf.get(l.productId) ?? "UNIT"),
        deal: l.deal,
      })),
    ),
    {
      terms: Object.fromEntries(
        analysis.rows.map((r) => [
          r.supplierId,
          {
            minOrderAgorot: r.supplier.minOrderAgorot,
            feeAgorot: r.supplier.delivery.feeAgorot,
            freeAboveAgorot: r.supplier.delivery.freeAboveAgorot,
          },
        ]),
      ),
      deliveriesPerMonth: basket.deliveriesPerMonth,
      currentSupplierId: basket.currentSupplierId,
    },
  );
}

/** האריזות האחרות של הספק לאותו מוצר, כטקסט קצר: "גם בשק 5 ק״ג: ₪6.90 לק״ג" */
export function otherPacksText(line: Pick<PricedLine, "otherPacks">, unit: Unit): string[] | undefined {
  if (!line.otherPacks?.length) return undefined;
  return line.otherPacks.map(
    (o) => `גם ב${o.packLabel ?? "אריזה אחרת"}: ${shekels(o.unitPriceAgorot, 2)} ל${UNIT_LABEL[unit]}`,
  );
}
