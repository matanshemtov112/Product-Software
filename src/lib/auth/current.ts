import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { type Role, SESSION_COOKIE, type Session, verifySession } from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** התפקיד העדכני של המשתמש במסד (פעם אחת לכל בקשה) */
const currentRole = cache(async (userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
});

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
