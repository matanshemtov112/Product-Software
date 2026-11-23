import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { type Role, SESSION_COOKIE, type Session, verifySession } from "./session";

/** המשתמש כפי שהוא במסד עכשיו (פעם אחת לכל בקשה) */
const currentUser = cache(async (userId: string) =>
  db.user.findUnique({ where: { id: userId }, select: { role: true, sessionVersion: true } }),
);

/**
 * ההתחברות הנוכחית. עוגייה של משתמש שנמחק, או שגרסת ההתחברות שלה ישנה (יצא מכל המכשירים או שינה סיסמה),
 * לא נחשבת התחברות, גם אם החתימה שלה תקינה.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await currentUser(session.userId);
  if (!user || user.sessionVersion !== session.v) return null;
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
  return session;
}
