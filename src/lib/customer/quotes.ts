import { redirect } from "next/navigation";
import type { Unit } from "@prisma/client";
import { db } from "@/lib/db";
import { comparePaidPrices, type PaidComparison } from "./paid-prices";
import { pricedPerPack, packPriceLabel } from "@/lib/pack";
import {
  optimizeBasket,
  quoteForSupplier,
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
  };
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
  const offers = new Map(supplier.offers.map((o) => [o.productId, o]));
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
      pack: offers.get(l.productId)?.packLabel,
      minOrder: offers.get(l.productId)?.minOrderLabel,
      packPrice: packPriceFor(l.unitPriceAgorot, offers.get(l.productId)?.packInfo),
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
    items: {
      productId: string;
      monthlyQuantity: number;
      currentUnitPriceAgorot: number | null;
      product: { name: string; unit: Unit };
    }[];
  },
  analysis: BasketAnalysis,
): PaidComparison {
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
      })),
    ),
  );
}
