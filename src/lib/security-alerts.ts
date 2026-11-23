import { db } from "@/lib/db";
import { appUrl, deliverQueued, queueEmails } from "@/lib/email";

/**
 * התראות על פעילות חשודה: נרשמות ביומן (security.alert) ונשלחות באימייל לכל מנהלי המערכת (ADMIN).
 * כל התראה נשלחת פעם אחת בשעה לכל נושא, כדי לא להציף.
 */
const DEDUPE_MS = 60 * 60_000;
const MINUTE = 60_000;

export interface SecurityEvent {
  action: string;
  userId?: string | null;
  actor?: string | null;
  ip?: string | null;
  details?: unknown;
}

interface Alert {
  key: string;
  title: string;
  body: string;
}

const count = (where: object, minutes: number) =>
  db.auditLog.count({ where: { ...where, createdAt: { gte: new Date(Date.now() - minutes * MINUTE) } } });

/** האם האירוע (יחד עם מה שקרה לפניו) נראה חשוד; מחזיר את ההתראה או null */
export async function suspicious(e: SecurityEvent): Promise<Alert | null> {
  switch (e.action) {
    case "login.blocked":
      return {
        key: `login-blocked:${e.actor}`,
        title: "ניסיונות כניסה חוזרים נחסמו",
        body: `הכניסה לחשבון ${e.actor ?? ""} נחסמה זמנית אחרי הרבה סיסמאות שגויות (כתובת ${e.ip ?? "לא ידועה"}). ייתכן שמישהו מנסה לנחש סיסמה.`,
      };
    case "login.failed": {
      if (!e.ip) return null;
      const fromIp = await count({ action: "login.failed", ip: e.ip }, 15);
      return fromIp >= 20
        ? {
            key: `login-spray:${e.ip}`,
            title: "הרבה כניסות שנכשלו מאותה כתובת",
            body: `${fromIp} ניסיונות כניסה שנכשלו ב-15 הדקות האחרונות מהכתובת ${e.ip}, לכמה חשבונות. ייתכן ניסיון פריצה.`,
          }
        : null;
    }
    case "access.denied": {
      if (!e.userId) return null;
      const denied = await count({ action: "access.denied", userId: e.userId }, 10);
      return denied >= 5
        ? {
            key: `denied:${e.userId}`,
            title: "משתמש מנסה שוב ושוב פעולות שאין לו הרשאה אליהן",
            body: `${e.actor ?? "משתמש"} ניסה ${denied} פעולות בלי הרשאה ב-10 הדקות האחרונות.`,
          }
        : null;
    }
    case "password.reset_requested": {
      const resets = await count({ action: "password.reset_requested" }, 60);
      return resets >= 20
        ? {
            key: "reset-burst",
            title: "הרבה בקשות לאיפוס סיסמה",
            body: `${resets} בקשות לאיפוס סיסמה בשעה האחרונה. ייתכן ניסיון להשתלט על חשבונות.`,
          }
        : null;
    }
    case "login.success": {
      // כניסה של מנהל מערכת מכתובת שלא נכנס ממנה ב-30 הימים האחרונים
      if (!e.userId || !e.ip) return null;
      const user = await db.user.findUnique({ where: { id: e.userId }, select: { role: true } });
      if (user?.role !== "ADMIN") return null;
      const known = await db.auditLog.count({
        where: {
          action: "login.success",
          userId: e.userId,
          ip: e.ip,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * MINUTE), lt: new Date(Date.now() - MINUTE) },
        },
      });
      return known === 0
        ? {
            key: `admin-new-ip:${e.userId}:${e.ip}`,
            title: "כניסה לחשבון מנהל מכתובת חדשה",
            body: `${e.actor ?? "מנהל"} נכנס לחשבון מנהל המערכת מהכתובת ${e.ip}, שלא נראתה ב-30 הימים האחרונים. אם זה לא אתם, החליפו סיסמה מיד.`,
          }
        : null;
    }
    default:
      return null;
  }
}

/** בודק אירוע ושולח התראה אם צריך. לא זורק שגיאה: התראה שנכשלה לא עוצרת את הפעולה עצמה */
export async function checkSecurityEvent(e: SecurityEvent) {
  try {
    const alert = await suspicious(e);
    if (!alert) return;
    const recent = await db.auditLog.findFirst({
      where: { action: "security.alert", targetId: alert.key, createdAt: { gte: new Date(Date.now() - DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return;
    await db.auditLog.create({
      data: {
        action: "security.alert",
        targetType: "security",
        targetId: alert.key,
        actor: "מערכת",
        ip: e.ip ?? null,
        details: { title: alert.title, body: alert.body },
      },
    });
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } });
    await queueEmails(
      admins.map((a) => ({
        userId: a.id,
        to: a.email,
        kind: "INSTANT",
        subject: `התראת אבטחה: ${alert.title}`,
        text: `${alert.body}\n\nכל ההתראות ביומן הפעולות: ${appUrl("/admin/audit?group=security")}`,
      })),
    );
    await deliverQueued(10);
  } catch (err) {
    console.error("security alert failed", err);
  }
}
