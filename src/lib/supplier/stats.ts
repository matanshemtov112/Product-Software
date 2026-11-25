import { db } from "@/lib/db";
import { VERIFIED_DAYS } from "@/lib/price-status";
import { type OfferWithPrices, pricesByTier } from "./catalog";

const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10));

/** רושם שהספקים הופיעו בהשוואה שהלקוח פתח; פעם אחת לכל ספק, סל ויום */
export async function recordSupplierViews(basketId: string, customerId: string, supplierIds: string[]) {
  if (supplierIds.length === 0) return;
  const day = today();
  await db.supplierView.createMany({
    data: [...new Set(supplierIds)].map((supplierId) => ({ supplierId, basketId, customerId, day })),
    skipDuplicates: true,
  });
}

export interface SupplierStats {
  /** כמה פעמים הספק הופיע בהשוואות ב-30 הימים האחרונים */
  views: number;
  /** כמה לקוחות שונים ראו אותו */
  customers: number;
  /** פניות ובקשות השוואה ב-30 הימים האחרונים */
  leads: number;
  /** מוצרים בלי מחיר פעיל באף מדרגה */
  withoutPrice: number;
  /** מוצרים עם מחיר שממתין לאישור */
  pendingPrice: number;
  /** מוצרים שהמחיר שלהם לא עודכן יותר מ-30 יום, ולכן מוצג ללקוחות כ"מחירון" */
  stalePrice: number;
}

export function offerPriceStats(offers: OfferWithPrices[], now = new Date()) {
  let withoutPrice = 0;
  let pendingPrice = 0;
  let stalePrice = 0;
  for (const offer of offers) {
    const tiers = [...pricesByTier(offer, now).values()];
    const live = tiers.filter((t) => t.live !== null);
    if (live.length === 0) withoutPrice++;
    if (tiers.some((t) => t.pending !== null)) pendingPrice++;
    const newest = Math.max(0, ...live.map((t) => t.liveSince?.getTime() ?? 0));
    if (live.length && now.getTime() - newest > VERIFIED_DAYS * DAY) stalePrice++;
  }
  return { withoutPrice, pendingPrice, stalePrice };
}

export async function supplierStats(supplierId: string, offers: OfferWithPrices[]): Promise<SupplierStats> {
  const since = new Date(Date.now() - 30 * DAY);
  const [views, customers, inquiries, matches] = await Promise.all([
    db.supplierView.count({ where: { supplierId, day: { gte: since } } }),
    db.supplierView.findMany({
      where: { supplierId, day: { gte: since } },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    db.negotiationRequest.count({ where: { supplierId, createdAt: { gte: since } } }),
    db.matchRequest.count({ where: { supplierId, createdAt: { gte: since } } }),
  ]);
  return { views, customers: customers.length, leads: inquiries + matches, ...offerPriceStats(offers) };
}
