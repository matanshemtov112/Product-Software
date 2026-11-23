import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/**
 * קישור לאיפוס סיסמה: חתום, בתוקף שעה, ועובד פעם אחת בלבד. הקישור קשור לסיסמה הנוכחית (טביעה שלה),
 * כך שאחרי שהסיסמה שונתה, הקישור הזה וכל קישור ישן אחר מפסיקים לעבוד.
 */
export const RESET_MINUTES = 60;

function key() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(value);
}

export const passwordFingerprint = (passwordHash: string) =>
  createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);

export async function resetToken(user: { id: string; passwordHash: string }) {
  return new SignJWT({ purpose: "password-reset", pf: passwordFingerprint(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${RESET_MINUTES}m`)
    .sign(key());
}

/** מזהה המשתמש וטביעת הסיסמה שבקישור; null לקישור לא תקין או שפג תוקפו */
export async function readResetToken(token: string): Promise<{ userId: string; fingerprint: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.purpose !== "password-reset" || typeof payload.sub !== "string" || typeof payload.pf !== "string") {
      return null;
    }
    return { userId: payload.sub, fingerprint: payload.pf };
  } catch {
    return null;
  }
}
