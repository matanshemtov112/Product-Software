import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Role, SESSION_COOKIE, type Session, verifySession } from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** לשימוש בדפים: מפנה להתחברות אם אין הרשאה מתאימה */
export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== role) redirect("/login");
  return session;
}
