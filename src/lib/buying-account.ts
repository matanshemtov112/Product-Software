import { cache } from "react";
import { db } from "@/lib/db";

/**
 * מסחר בין ספקים: לספק יכול להיות "חשבון קנייה" (Customer עם ownerSupplierId), שדרכו הוא קונה מספקים אחרים
 * בדיוק כמו מסעדה (למשל מפעל עוגיות שקונה קמח). אותו משתמש עובר בין צד המכירה לצד הקנייה.
 *
 * סודיות: ספק לא רואה מחירים של מתחרים. לכן בחשבון הקנייה לא מוצגים מחירים של ספקים אחרים על מוצרים
 * שהספק עצמו מוכר, והספק לא מופיע לעצמו בהשוואות.
 */

/** המוצרים שהספק בעל חשבון הקנייה מוכר; לעסק רגיל קבוצה ריקה */
export const restrictedProductIds = cache(async (customerId: string): Promise<Set<string>> => {
  const offers = await db.supplierOffer.findMany({
    where: { archivedAt: null, supplier: { buyingAccount: { is: { id: customerId } } } },
    select: { productId: true },
    distinct: ["productId"],
  });
  return new Set(offers.map((o) => o.productId));
});

/** מסנן רשימה לפי המוצרים שמותר להציג מחירים עליהם */
export async function withoutRestricted<T extends { productId: string }>(customerId: string, rows: T[]): Promise<T[]> {
  const restricted = await restrictedProductIds(customerId);
  return restricted.size ? rows.filter((r) => !restricted.has(r.productId)) : rows;
}

export const RESTRICTED_NOTE = "אתם מוכרים את המוצר הזה, ולכן לא מוצגים לכם מחירים של ספקים אחרים עליו";

/** חשבון הקנייה של ספק, אם נפתח */
export function buyingAccountOf(supplierId: string) {
  return db.customer.findUnique({
    where: { ownerSupplierId: supplierId },
    select: { id: true, businessName: true, city: true, region: { select: { name: true } } },
  });
}
