import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, type Session, signSession } from "./session";

/** יוצר עוגיית התחברות למשתמש, עם גרסת ההתחברות הנוכחית שלו */
export async function startSession(user: { id: string; role: Session["role"]; name: string; sessionVersion: number }) {
  const store = await cookies();
  const session: Session = { userId: user.id, role: user.role, name: user.name, v: user.sessionVersion };
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}
