import { db } from "@/lib/db";
import type { PaidComparisonLine } from "./paid-prices";
import { analyzeBasket, paidComparison } from "./quotes";
import { scoreSupplier, type SupplierScore } from "./supplier-score";

export interface Opportunity {
  supplierId: string;
  supplierName: string;
  products: string[];
  monthlySavingAgorot: number;
  /** הסל שממנו נשלחת הפנייה לספק */
  basketId: string;
}

export interface MySupplier {
  /** מזהה לכתובת: השם כפי שהלקוח כתב אותו */
  key: string;
  name: string;
  /** הספק במערכת, אם הספק הנוכחי רשום אצלנו */
  supplierId: string | null;
  lines: PaidComparisonLine[];
  score: SupplierScore;
  opportunities: Opportunity[];
  baskets: { id: string; name: string }[];
}

const keyOf = (name: string) => name.trim().toLocaleLowerCase("he-IL");

/**
 * "הספקים שלי": הספקים שהלקוח עובד איתם היום, לפי הסלים שבהם מילא ספק נוכחי ומחירים.
 * אותו ספק בכמה סלים מתאחד; כשמוצר מופיע בכמה סלים, נלקח הסל העדכני ביותר.
 */
export async function mySuppliers(customerId: string): Promise<MySupplier[]> {
  const baskets = await db.basket.findMany({
    where: {
      customerId,
      OR: [{ currentSupplierName: { not: null } }, { currentSupplierId: { not: null } }],
      items: { some: { currentUnitPriceAgorot: { not: null } } },
    },
    include: {
      items: { include: { product: { include: { category: true } } } },
      currentSupplier: { select: { id: true, companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const groups = new Map<string, MySupplier & { lineBasket: Map<string, string> }>();
  for (const basket of baskets) {
    const name = (basket.currentSupplier?.companyName ?? basket.currentSupplierName ?? "").trim();
    if (!name) continue;
    const key = keyOf(name);
    const group = groups.get(key) ?? {
      key: name,
      name,
      supplierId: basket.currentSupplier?.id ?? null,
      lines: [],
      score: scoreSupplier([]),
      opportunities: [],
      baskets: [],
      lineBasket: new Map<string, string>(),
    };
    group.baskets.push({ id: basket.id, name: basket.name });
    group.supplierId ??= basket.currentSupplier?.id ?? null;
    const paid = paidComparison(basket, await analyzeBasket(basket.id));
    for (const line of paid.lines) {
      if (group.lineBasket.has(line.productId)) continue;
      group.lineBasket.set(line.productId, basket.id);
      group.lines.push(line);
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ lineBasket, ...g }) => {
      const bySupplier = new Map<string, Opportunity>();
      for (const l of g.lines) {
        if (!l.best || l.monthlySavingAgorot <= 0 || l.best.supplierId === g.supplierId) continue;
        const o = bySupplier.get(l.best.supplierId) ?? {
          supplierId: l.best.supplierId,
          supplierName: l.best.supplierName,
          products: [],
          monthlySavingAgorot: 0,
          basketId: lineBasket.get(l.productId)!,
        };
        o.products.push(l.productName);
        o.monthlySavingAgorot += l.monthlySavingAgorot;
        bySupplier.set(l.best.supplierId, o);
      }
      return {
        ...g,
        lines: g.lines.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot),
        score: scoreSupplier(g.lines),
        opportunities: [...bySupplier.values()].sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot),
      };
    })
    .sort((a, b) => b.score.monthlySavingAgorot - a.score.monthlySavingAgorot);
}
