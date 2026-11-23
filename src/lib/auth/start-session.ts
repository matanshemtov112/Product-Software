import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MFA_COOKIE, MFA_MINUTES, mfaPendingToken } from "./two-factor";
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

/** אחרי סיסמה נכונה למשתמש עם אימות דו-שלבי: שומר אישור זמני ועובר למסך הקוד */
export async function beginMfa(user: { id: string; sessionVersion: number }): Promise<never> {
  const store = await cookies();
  store.set(MFA_COOKIE, await mfaPendingToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MFA_MINUTES * 60,
    path: "/",
  });
  redirect("/login/verify");
}
