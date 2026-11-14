import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

/**
 * מדיניות שמירה: הקובץ של החשבונית לא נשמר בכלל. מה שנקרא ממנה (שורות, מחירים, שם הספק)
 * נשמר כדי שהלקוח יוכל לבדוק ולתקן, ונמחק אחרי 90 יום. הסל שנבנה מהחשבונית נשאר.
 */
export const INVOICE_RETENTION_DAYS = 90;

export async function purgeOldInvoices(now = new Date()) {
  const before = new Date(now.getTime() - INVOICE_RETENTION_DAYS * 86_400_000);
  const { count } = await db.invoice.deleteMany({ where: { createdAt: { lt: before } } });
  if (count > 0)
    await audit({ action: "invoices.purged", actor: "מערכת", details: { count, before: before.toISOString() } });
  return count;
}
