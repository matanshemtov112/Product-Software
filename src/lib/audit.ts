import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";

/** כתובת ה-IP של הבקשה (מאחורי פרוקסי: הראשונה ב-x-forwarded-for) */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export const AUDIT_LABEL: Record<string, string> = {
  "login.success": "כניסה",
  "login.failed": "ניסיון כניסה שנכשל",
  "login.blocked": "כניסה נחסמה (יותר מדי ניסיונות)",
  register: "הרשמה",
  "price.changed": "שינוי מחיר",
  "price.held": "שינוי מחיר גדול ממתין לאישור",
  "price.promotion-ended": "סיום מבצע",
  "deal.saved": "מבצע כמות נשמר",
  "deal.removed": "מבצע כמות הוסר",
  "price.approved": "אדמין אישר מחיר",
  "price.rejected": "אדמין דחה מחיר",
  "supplier.status": "שינוי סטטוס ספק",
  "product.updated": "עדכון מוצר בקטלוג",
  "product.merged": "מיזוג מוצרים",
  "category.created": "הוספת קטגוריה",
  "category.renamed": "שינוי שם קטגוריה",
  "category.deleted": "מחיקת קטגוריה",
  "review.status": "שינוי סטטוס ביקורת",
  "team.added": "הוספת משתמש לצוות",
  "team.updated": "שינוי משתמש בצוות",
  "business.updated": "עדכון פרטי העסק",
  "report.created": "דיווח חדש",
  "report.closed": "טיפול בדיווח",
  "invoice.deleted": "מחיקת חשבונית",
  "invoices.purged": "מחיקת חשבוניות ישנות לפי מדיניות",
};

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  /** כשאין עדיין session (למשל כניסה שנכשלה) */
  actor?: string;
  userId?: string;
}

/** רושם פעולה ביומן. כשל ברישום לא עוצר את הפעולה עצמה */
export async function audit(entry: AuditEntry) {
  try {
    const session = entry.userId || entry.actor ? null : await getSession();
    await db.auditLog.create({
      data: {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details,
        userId: entry.userId ?? session?.userId ?? null,
        actor: entry.actor ?? session?.name ?? null,
        ip: await clientIp(),
      },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}
