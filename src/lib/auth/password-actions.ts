"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, clientIp } from "@/lib/audit";
import { db } from "@/lib/db";
import { appUrl, deliverQueued, queueEmails } from "@/lib/email";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getSession } from "./current";
import { hashPassword, verifyPassword } from "./password";
import { passwordFingerprint, readResetToken, RESET_MINUTES, resetToken } from "./reset-token";
import { HOME_BY_ROLE, SESSION_COOKIE } from "./session";
import { startSession } from "./start-session";

export interface PasswordFormState {
  error?: string;
  done?: boolean;
}

const newPassword = z.string().min(8, "סיסמה של 8 תווים לפחות").max(200, "הסיסמה ארוכה מדי");

/** שינוי סיסמה: צריך את הסיסמה הנוכחית. כל שאר המכשירים מתנתקים, והמכשיר הזה נשאר מחובר */
export async function changePassword(_: PasswordFormState, form: FormData): Promise<PasswordFormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  const parsed = newPassword.safeParse(String(form.get("newPassword") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (String(form.get("confirm") ?? "") !== parsed.data) return { error: "שתי הסיסמאות החדשות לא זהות" };
  if (!(await rateLimit.hit(`password-change:${user.id}`, LIMITS.loginFailures))) {
    return { error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." };
  }
  if (!(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) {
    await audit({ action: "password.change_failed", userId: user.id, actor: user.name });
    return { error: "הסיסמה הנוכחית שגויה" };
  }
  if (await verifyPassword(parsed.data, user.passwordHash)) return { error: "הסיסמה החדשה זהה לנוכחית" };
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data), sessionVersion: { increment: 1 } },
  });
  await startSession(updated);
  await audit({ action: "password.changed", userId: user.id, actor: user.name });
  return { done: true };
}

/** יציאה מכל המכשירים: כל עוגיות ההתחברות של המשתמש מפסיקות לעבוד, גם אם נגנבו */
export async function logoutEverywhere() {
  const session = await getSession();
  if (session) {
    await db.user.update({ where: { id: session.userId }, data: { sessionVersion: { increment: 1 } } });
    await audit({ action: "logout.everywhere", userId: session.userId, actor: session.name });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?out=all");
}

/**
 * שכחתי סיסמה: שולח קישור לאיפוס לאימייל. התשובה זהה בין אם האימייל רשום ובין אם לא,
 * כדי שאי אפשר יהיה לבדוק דרכה מי רשום במערכת.
 */
export async function requestPasswordReset(_: PasswordFormState, form: FormData): Promise<PasswordFormState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { error: "נא למלא אימייל תקין" };
  const ip = (await clientIp()) ?? "unknown";
  const allowed =
    (await rateLimit.hit(`reset-ip:${ip}`, LIMITS.passwordReset)) &&
    (await rateLimit.hit(`reset:${email.data}`, LIMITS.passwordReset));
  const user = allowed ? await db.user.findUnique({ where: { email: email.data } }) : null;
  if (user) {
    const link = appUrl(`/reset-password?t=${await resetToken(user)}`);
    await queueEmails([
      {
        userId: user.id,
        to: user.email,
        kind: "INSTANT",
        subject: "איפוס סיסמה",
        text: [
          `שלום ${user.name},`,
          "",
          "ביקשתם לאפס את הסיסמה. לבחירת סיסמה חדשה:",
          link,
          "",
          `הקישור בתוקף ${RESET_MINUTES} דקות ועובד פעם אחת. אם לא ביקשתם, אפשר להתעלם מההודעה, והסיסמה לא תשתנה.`,
        ].join("\n"),
      },
    ]);
    await audit({ action: "password.reset_requested", userId: user.id, actor: user.email });
    after(() => deliverQueued(5));
  }
  return { done: true };
}

/** בחירת סיסמה חדשה מהקישור שבאימייל. כל המכשירים מתנתקים, והמשתמש נכנס עם הסיסמה החדשה */
export async function resetPassword(_: PasswordFormState, form: FormData): Promise<PasswordFormState> {
  const token = await readResetToken(String(form.get("t") ?? ""));
  const user = token ? await db.user.findUnique({ where: { id: token.userId } }) : null;
  if (!token || !user || passwordFingerprint(user.passwordHash) !== token.fingerprint) {
    return { error: "הקישור לא תקין, פג תוקפו או שכבר השתמשו בו. אפשר לבקש קישור חדש." };
  }
  const parsed = newPassword.safeParse(String(form.get("newPassword") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (String(form.get("confirm") ?? "") !== parsed.data) return { error: "שתי הסיסמאות לא זהות" };
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data), sessionVersion: { increment: 1 } },
  });
  await audit({ action: "password.reset", userId: user.id, actor: user.email });
  await startSession(updated);
  redirect(HOME_BY_ROLE[updated.role]);
}
