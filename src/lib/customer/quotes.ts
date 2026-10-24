import type { Unit } from "@prisma/client";
import { db } from "@/lib/db";
import { optimizeBasket, quoteForSupplier, type EngineResult, type SupplierQuote } from "@/lib/engine";
import { loadEngineInput } from "@/lib/engine/load";
import type { QuoteSnapshot } from "@/lib/inquiries";

/** הלקוח של המשתמש המחובר, עם האזור שלו */
export async function customerForUser(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { customer: { include: { region: true } } },
  });
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
}

export interface BasketAnalysis {
  result: EngineResult;
  /** ההצעה של כל ספק רלוונטי, מהקטן לגדול לפי הפער */
  rows: QuoteRow[];
  lineCount: number;
}

/** מריץ את המנוע על סל: שלוש האפשרויות, וההצעה של כל ספק מול החלופה הזולה לאותם מוצרים */
export async function analyzeBasket(basketId: string): Promise<BasketAnalysis> {
  const { basket, lines, suppliers, options } = await loadEngineInput(basketId);
  const result = optimizeBasket(lines, suppliers, options);
  const units = new Map(basket.items.map((i) => [i.productId, i.product.unit]));
  const names = new Map(lines.map((l) => [l.productId, l.productName]));
  const rows: QuoteRow[] = [];
  for (const s of suppliers) {
    const quote = quoteForSupplier(lines, suppliers, options, s.id);
    if (!quote) continue;
    rows.push({ supplierId: s.id, supplierName: s.name, quote, snapshot: snapshot(quote, units, names) });
  }
  rows.sort((a, b) => a.quote.gapAgorot - b.quote.gapAgorot || a.quote.share.totalAgorot - b.quote.share.totalAgorot);
  return { result, rows, lineCount: lines.filter((l) => l.quantity > 0).length };
}

function snapshot(quote: SupplierQuote, units: Map<string, Unit>, names: Map<string, string>): QuoteSnapshot {
  const { share } = quote;
  return {
    tierName: share.tierName,
    lines: share.lines.map((l) => ({
      productName: l.productName,
      unit: units.get(l.productId) ?? "UNIT",
      quantity: l.quantity,
      billedQuantity: l.billedQuantity,
      unitPriceAgorot: l.unitPriceAgorot,
      lineTotalAgorot: l.lineTotalAgorot,
    })),
    productsAgorot: share.productsAgorot,
    deliveryAgorot: share.deliveryAgorot,
    totalAgorot: share.totalAgorot,
    missingProducts: quote.missingProductIds.map((id) => names.get(id) ?? id),
  };
}
