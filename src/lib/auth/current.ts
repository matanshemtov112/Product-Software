import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { type Role, SESSION_COOKIE, type Session, verifySession } from "./session";

/** המשתמש כפי שהוא במסד עכשיו (פעם אחת לכל בקשה) */
const currentUser = cache(async (userId: string) =>
  db.user.findUnique({ where: { id: userId }, select: { role: true, sessionVersion: true, totpEnabledAt: true } }),
);

/**
 * ההתחברות הנוכחית. עוגייה של משתמש שנמחק, או שגרסת ההתחברות שלה ישנה (יצא מכל המכשירים או שינה סיסמה),
 * לא נחשבת התחברות, גם אם החתימה שלה תקינה.
 */
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** האם העוגייה בוטלה ביציאה רגילה (פעם אחת לכל בקשה) */
const isRevoked = cache(
  async (token: string) => !!(await db.revokedSession.findUnique({ where: { tokenHash: tokenHash(token) } })),
);

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session || !token) return null;
  const [user, revoked] = await Promise.all([currentUser(session.userId), isRevoked(token)]);
  if (!user || revoked || user.sessionVersion !== session.v) return null;
  return session;
}

const currentRole = async (userId: string) => (await currentUser(userId))?.role ?? null;

/**
 * לשימוש בדפים: מפנה להתחברות אם אין הרשאה מתאימה.
 * נבדק גם מול המסד, כך שמשתמש שהוסר מהצוות או שהתפקיד שלו השתנה מנותק מיד, ולא כשהעוגייה פגה.
 */
export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== role) redirect("/login");
  if ((await currentRole(session.userId)) !== role) {
    const store = await cookies();
    try {
      store.delete(SESSION_COOKIE);
    } catch {
      // בדף (ולא בפעולה) אי אפשר למחוק עוגייה; ההפניה מספיקה
    }
    redirect("/login");
  }
  // מנהל מערכת בלי אימות דו-שלבי לא עובר, לא בדפים ולא בפעולות (פעולה שנקראת ישירות בודקת כאן)
  if (role === "ADMIN" && !(await currentUser(session.userId))?.totpEnabledAt) redirect("/account/security?required=1");
  return session;
}
