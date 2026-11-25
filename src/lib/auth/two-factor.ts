import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

/**
 * אימות דו-שלבי (TOTP, תקן RFC 6238) עם אפליקציית אימות כמו Google Authenticator או Microsoft Authenticator.
 * הסוד נשמר במסד מוצפן (AES-256-GCM), כך שגם מי שמשיג עותק של המסד לא יכול לייצר קודים.
 */
const ISSUER = "השוואת ספקים";
export const MFA_COOKIE = "mfa_pending";
export const MFA_MINUTES = 5;
export const RECOVERY_CODES = 8;

function rawKey() {
  const value = process.env.TOTP_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return value;
}
const aesKey = () => createHash("sha256").update(`totp:${rawKey()}`).digest();
const jwtKey = () => new TextEncoder().encode(rawKey());

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string | null {
  try {
    const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const newTotpSecret = () => new OTPAuth.Secret({ size: 20 }).base32;

function totp(secret: string, label: string) {
  return new OTPAuth.TOTP({ issuer: ISSUER, label, secret, algorithm: "SHA1", digits: 6, period: 30 });
}

/** בודק קוד בן 6 ספרות (מאפשר סטייה של 30 שניות בשעון של הטלפון) */
export function verifyTotp(secret: string, code: string): boolean {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  return totp(secret, "x").validate({ token, window: 1 }) !== null;
}

/** קוד QR לסריקה באפליקציית האימות, ואותו סוד גם כטקסט להקלדה ידנית */
export async function totpSetup(secret: string, email: string) {
  const uri = totp(secret, email).toString();
  return { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
}

const hashCode = (code: string) => createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex");

/** קודי גיבוי חד-פעמיים: מוצגים פעם אחת, ונשמר רק הגיבוב שלהם */
export function newRecoveryCodes() {
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    const s = randomBytes(5).toString("hex");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}

/** אם הקוד הוא קוד גיבוי תקף: מחזיר את רשימת הגיבובים בלעדיו (הקוד נשרף), אחרת null */
export function consumeRecoveryCode(hashes: string[], code: string): string[] | null {
  const h = Buffer.from(hashCode(code));
  const index = hashes.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), h));
  return index === -1 ? null : hashes.filter((_, i) => i !== index);
}

/** אחרי סיסמה נכונה, למשתמש עם אימות דו-שלבי: אישור זמני (5 דקות) להזנת הקוד, עדיין בלי התחברות */
export async function mfaPendingToken(user: { id: string; sessionVersion: number }) {
  return new SignJWT({ purpose: "mfa", v: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MFA_MINUTES}m`)
    .sign(jwtKey());
}

export async function readMfaPending(token: string | undefined): Promise<{ userId: string; v: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    if (payload.purpose !== "mfa" || typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    return { userId: payload.sub, v: payload.v };
  } catch {
    return null;
  }
}
