import { db } from "@/lib/db";
import type { EffectiveCost } from "./effective-cost";
import type { BlockedSaving, PaidComparisonLine } from "./paid-prices";
import { analyzeBasket, paidComparison } from "./quotes";
import { scoreSupplier, type SupplierScore } from "./supplier-score";

export interface Opportunity {
  supplierId: string;
  supplierName: string;
  products: string[];
  /** החיסכון האמיתי בחודש, אחרי משלוח ומינימום הזמנה */
  monthlySavingAgorot: number;
  cost: EffectiveCost;
  /** הסל שממנו נשלחת הפנייה לספק */
  basketId: string;
}

/** ספק זול ליחידה שלא משתלם בפועל */
export interface BlockedOpportunity extends Opportunity {
  reason: BlockedSaving["reason"];
  currentShortfallPerOrderAgorot: number;
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
  blocked: BlockedOpportunity[];
  /** החיסכון האמיתי בחודש אם עוברים לספקים בהזדמנויות */
  monthlySavingAgorot: number;
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
      blocked: [],
      monthlySavingAgorot: 0,
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
    // ההזדמנויות לפי עלות אפקטיבית, מכל סל בנפרד (לכל סל יש מספר אספקות משלו)
    for (const o of paid.suppliers) {
      if (o.supplierId === group.supplierId) continue;
      group.opportunities.push({ ...o, basketId: basket.id });
    }
    for (const o of paid.blocked) {
      if (o.supplierId === group.supplierId) continue;
      group.blocked.push({ ...o, basketId: basket.id });
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ lineBasket, ...g }) => ({
      ...(void lineBasket, g),
      lines: g.lines.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot),
      score: scoreSupplier(g.lines),
      opportunities: g.opportunities.sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot),
      monthlySavingAgorot: g.opportunities.reduce((sum, o) => sum + o.monthlySavingAgorot, 0),
    }))
    .sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot || a.score.score - b.score.score);
}
