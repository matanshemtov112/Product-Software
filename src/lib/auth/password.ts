import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** מחזיר "salt:hash" בהקסדצימלי */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

let dummy: Promise<string> | null = null;

/** גיבוב קבוע לבדיקת סיסמה כשאין משתמש, כדי שזמן התשובה יהיה זהה */
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword(randomBytes(16).toString("hex")));
}
