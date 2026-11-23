"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getSession } from "./current";
import { verifyPassword } from "./password";
import { notifyUserSecurity } from "./security-mail";
import { HOME_BY_ROLE } from "./session";
import { startSession } from "./start-session";
import {
  decryptSecret,
  encryptSecret,
  MFA_COOKIE,
  newRecoveryCodes,
  newTotpSecret,
  readMfaPending,
  consumeRecoveryCode,
  verifyTotp,
} from "./two-factor";

export interface MfaFormState {
  error?: string;
  /** קודי גיבוי חדשים, מוצגים פעם אחת */
  codes?: string[];
}

const SECURITY_PAGE = "/account/security";

/** שלב שני בכניסה: קוד מאפליקציית האימות, או קוד גיבוי */
export async function verifyMfa(_: MfaFormState, form: FormData): Promise<MfaFormState> {
  const store = await cookies();
  const pending = await readMfaPending(store.get(MFA_COOKIE)?.value);
  if (!pending) return { error: "עבר יותר מדי זמן. התחברו שוב עם הסיסמה." };
  const user = await db.user.findUnique({ where: { id: pending.userId } });
  if (!user || user.sessionVersion !== pending.v || !user.totpSecret) {
    return { error: "עבר יותר מדי זמן. התחברו שוב עם הסיסמה." };
  }
  if (!(await rateLimit.hit(`mfa:${user.id}`, LIMITS.loginFailures))) {
    await audit({ action: "login.blocked", userId: user.id, actor: user.email, details: { step: "קוד אימות" } });
    store.delete(MFA_COOKIE);
    return { error: "יותר מדי קודים שגויים. נסו שוב בעוד רבע שעה." };
  }
  const code = String(form.get("code") ?? "").trim();
  const secret = decryptSecret(user.totpSecret);
  let method = "אפליקציה";
  if (!secret || !verifyTotp(secret, code)) {
    const left = consumeRecoveryCode(user.recoveryCodes, code);
    if (!left) {
      await audit({ action: "login.mfa_failed", userId: user.id, actor: user.email });
      return { error: "הקוד שגוי. בדקו שהשעה בטלפון מכוונת ונסו שוב." };
    }
    await db.user.update({ where: { id: user.id }, data: { recoveryCodes: left } });
    method = `קוד גיבוי (נשארו ${left.length})`;
    await notifyUserSecurity(user, "נכנסתם עם קוד גיבוי", `נכנסתם לחשבון עם קוד גיבוי. נשארו ${left.length} קודים.`);
  }
  store.delete(MFA_COOKIE);
  await rateLimit.reset(`mfa:${user.id}`);
  await startSession(user);
  await audit({ action: "login.success", userId: user.id, actor: user.name, details: { "אימות דו-שלבי": method } });
  redirect(HOME_BY_ROLE[user.role]);
}

async function me() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  return user;
}

/** תחילת הפעלה: יוצר סוד חדש (עוד לא פעיל) ומציג אותו כקוד QR */
export async function startTotpSetup() {
  const user = await me();
  if (user.totpEnabledAt) redirect(SECURITY_PAGE);
  await db.user.update({ where: { id: user.id }, data: { totpPendingSecret: encryptSecret(newTotpSecret()) } });
  redirect(`${SECURITY_PAGE}?setup=1`);
}

/** אישור ההפעלה בקוד הראשון מהאפליקציה; מחזיר קודי גיבוי להצגה פעם אחת */
export async function confirmTotpSetup(_: MfaFormState, form: FormData): Promise<MfaFormState> {
  const user = await me();
  const secret = user.totpPendingSecret ? decryptSecret(user.totpPendingSecret) : null;
  if (!secret) return { error: "ההגדרה פגה. התחילו מחדש." };
  if (!(await rateLimit.hit(`mfa-setup:${user.id}`, LIMITS.loginFailures))) {
    return { error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." };
  }
  if (!verifyTotp(secret, String(form.get("code") ?? ""))) {
    return { error: "הקוד שגוי. הקלידו את 6 הספרות שמופיעות עכשיו באפליקציה." };
  }
  const { codes, hashes } = newRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: encryptSecret(secret),
      totpPendingSecret: null,
      totpEnabledAt: new Date(),
      recoveryCodes: hashes,
    },
  });
  await audit({ action: "2fa.enabled", userId: user.id, actor: user.name });
  await notifyUserSecurity(
    user,
    "אימות דו-שלבי הופעל",
    "הפעלתם אימות דו-שלבי. מעכשיו כל כניסה תדרוש גם קוד מהאפליקציה.",
  );
  revalidatePath(SECURITY_PAGE);
  return { codes };
}

/** כיבוי: צריך סיסמה וקוד. למנהלי המערכת אי אפשר לכבות (חובה אצלם) */
export async function disableTotp(_: MfaFormState, form: FormData): Promise<MfaFormState> {
  const user = await me();
  if (!user.totpSecret) redirect(SECURITY_PAGE);
  if (user.role === "ADMIN") return { error: "למנהלי המערכת האימות הדו-שלבי הוא חובה." };
  if (!(await rateLimit.hit(`mfa-disable:${user.id}`, LIMITS.loginFailures))) {
    return { error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." };
  }
  const secret = decryptSecret(user.totpSecret);
  const passwordOk = await verifyPassword(String(form.get("password") ?? ""), user.passwordHash);
  if (!passwordOk || !secret || !verifyTotp(secret, String(form.get("code") ?? ""))) {
    await audit({ action: "2fa.disable_failed", userId: user.id, actor: user.name });
    return { error: "הסיסמה או הקוד שגויים." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: [] },
  });
  await audit({ action: "2fa.disabled", userId: user.id, actor: user.name });
  await notifyUserSecurity(user, "אימות דו-שלבי כובה", "האימות הדו-שלבי בחשבון שלכם כובה.");
  revalidatePath(SECURITY_PAGE);
  redirect(SECURITY_PAGE);
}

/** קודי גיבוי חדשים (הישנים מפסיקים לעבוד); צריך קוד מהאפליקציה */
export async function regenerateRecoveryCodes(_: MfaFormState, form: FormData): Promise<MfaFormState> {
  const user = await me();
  const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
  if (!secret) redirect(SECURITY_PAGE);
  if (!(await rateLimit.hit(`mfa-setup:${user.id}`, LIMITS.loginFailures))) {
    return { error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה." };
  }
  if (!verifyTotp(secret, String(form.get("code") ?? ""))) return { error: "הקוד שגוי." };
  const { codes, hashes } = newRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { recoveryCodes: hashes } });
  await audit({ action: "2fa.codes_regenerated", userId: user.id, actor: user.name });
  return { codes };
}
