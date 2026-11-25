import { clientIpFrom } from "@/lib/flood";
import { checkSecurityEvent } from "@/lib/security-alerts";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";

/**
 * כתובת ה-IP של הבקשה. מאחורי פרוקסי: x-real-ip שהפרוקסי קובע, או הכתובת האחרונה ב-x-forwarded-for
 * (שהפרוקסי מוסיף). הכתובת הראשונה ברשימה מגיעה מהדפדפן ואפשר לזייף אותה, ולכן לא סומכים עליה.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    // הכתובת נלקחת רק מכותרת שהשרת המארח קובע בעצמו, ולא מכותרת שהדפדפן יכול לזייף.
    // TRUSTED_IP_HEADER: שם הכותרת אצל המארח (למשל x-real-ip ב-Vercel). ברירת מחדל: הכתובת האחרונה
    // ב-x-forwarded-for, שהשרת המתווך שלפני האתר מוסיף בעצמו
    return clientIpFrom(h);
  } catch {
    return null;
  }
}

export const AUDIT_LABEL: Record<string, string> = {
  "login.success": "כניסה",
  "login.failed": "ניסיון כניסה שנכשל",
  "login.blocked": "כניסה נחסמה (יותר מדי ניסיונות)",
  "security.alert": "התראת אבטחה",
  "login.mfa_failed": "קוד אימות דו-שלבי שגוי",
  "2fa.enabled": "הפעלת אימות דו-שלבי",
  "2fa.disabled": "כיבוי אימות דו-שלבי",
  "2fa.disable_failed": "ניסיון כיבוי אימות דו-שלבי שנכשל",
  "2fa.codes_regenerated": "קודי גיבוי חדשים",
  "access.denied": "ניסיון פעולה בלי הרשאה",
  "password.changed": "שינוי סיסמה",
  "password.change_failed": "ניסיון שינוי סיסמה שנכשל",
  "password.reset_requested": "בקשה לאיפוס סיסמה",
  "password.reset": "איפוס סיסמה",
  logout: "יציאה",
  "logout.everywhere": "יציאה מכל המכשירים",
  "supplier.delivery_schedule": "עדכון ימי חלוקה",
  "supplier.kosher": "עדכון כשרות",
  "supplier.whatsapp": "הגדרת וואטסאפ",
  "guarantee.change_requested": "בקשה לשינוי מחיר מובטח",
  "guarantee.change_approved": "שינוי מחיר מובטח אושר",
  "guarantee.change_declined": "שינוי מחיר מובטח נדחה",
  "guarantee.change_withdrawn": "בקשה לשינוי מחיר מובטח בוטלה",
  "guarantee.breach": "חשבונית מעל המחיר המובטח",
  "business.kosher": "עדכון דרישת כשרות",
  "pricelist.downloaded": "הורדת מחירון לאקסל",
  "pricelist.imported": "עדכון מחירון מקובץ",
  "side.switched": "מעבר בין צד הספק לצד הקנייה",
  "buying.opened": "פתיחת חשבון קנייה לספק",
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
  "invoices.deleted": "מחיקת כל החשבוניות",
  "basket.deleted": "מחיקת סל",
  "inquiry.sent": "פנייה נשלחה לספק",
  "match.sent": "בקשת השוואה נשלחה לספק",
  "offer.accepted": "הצעה התקבלה",
  "hold.released": "מסגרת אשראי שוחררה",
  "hold.captured": "נגבו דמי אי-הזמנה ממסגרת אשראי",
  "offer.rejected": "הצעה נדחתה",
  "offer.cancelled": "פנייה בוטלה",
  "inquiry.replied": "תשובה לפנייה נשלחה",
  "match.answered": "תשובה לבקשת השוואה נשלחה",
  "offer.withdrawn": "הצעה של ספק בוטלה",
  "offer.archived": "מוצר הועבר לארכיון",
  "offer.restored": "מוצר הוחזר מהארכיון",
  "supplier.blocked": "חסימת ספק",
  "supplier.muted": "השתקת ספק",
  "supplier.unblocked": "ביטול חסימה או השתקה של ספק",
  "notifications.updated": "עדכון הגדרות התראות",
  "notifications.unsubscribed": "הסרה מאימיילים דרך קישור",
  "marketing.consent_given": "הסכמה לקבל פרסומות באימייל",
  "marketing.consent_withdrawn": "ביטול הסכמה לפרסומות באימייל",
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
/** פעולות שנבדקות לפעילות חשודה */
const SECURITY_ACTIONS = new Set([
  "login.blocked",
  "login.failed",
  "login.success",
  "access.denied",
  "password.reset_requested",
  "login.mfa_failed",
  "2fa.disabled",
  "2fa.disable_failed",
]);

export async function audit(entry: AuditEntry) {
  try {
    const session = entry.userId || entry.actor ? null : await getSession();
    const row = await db.auditLog.create({
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
    if (SECURITY_ACTIONS.has(row.action)) await checkSecurityEvent(row);
  } catch (e) {
    console.error("audit failed", e);
  }
}
