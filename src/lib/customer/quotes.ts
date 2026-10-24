import type { Unit } from "@prisma/client";
import { db } from "@/lib/db";
import { quoteForSupplier, type SupplierQuote } from "@/lib/engine";
import { loadEngineInput } from "@/lib/engine/load";
import type { QuoteSnapshot } from "@/lib/inquiries";

/** הלקוח של המשתמש המחובר, עם האזור והסל הראשון שלו */
export async function customerForUser(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { customer: { include: { region: true, baskets: { orderBy: { createdAt: "asc" }, take: 1 } } } },
  });
  if (!user.customer) throw new Error("User is not linked to a customer");
  return user.customer;
}

export interface QuoteRow {
  supplierId: string;
  supplierName: string;
  quote: SupplierQuote;
  snapshot: QuoteSnapshot;
}

/** ההצעה של כל ספק רלוונטי לסל, מהזול לפי הפער */
export async function basketQuotes(basketId: string): Promise<{ rows: QuoteRow[]; lineCount: number }> {
  const { basket, lines, suppliers, options } = await loadEngineInput(basketId);
  const units = new Map(basket.items.map((i) => [i.productId, i.product.unit]));
  const names = new Map(lines.map((l) => [l.productId, l.productName]));
  const rows: QuoteRow[] = [];
  for (const s of suppliers) {
    const quote = quoteForSupplier(lines, suppliers, options, s.id);
    if (!quote) continue;
    rows.push({
      supplierId: s.id,
      supplierName: s.name,
      quote,
      snapshot: snapshot(quote, units, names),
    });
  }
  rows.sort((a, b) => a.quote.gapAgorot - b.quote.gapAgorot || a.quote.share.totalAgorot - b.quote.share.totalAgorot);
  return { rows, lineCount: lines.filter((l) => l.quantity > 0).length };
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
