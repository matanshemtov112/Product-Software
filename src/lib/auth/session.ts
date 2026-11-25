import { jwtVerify, SignJWT } from "jose";

export type Role = "CUSTOMER" | "SUPPLIER" | "ADMIN";

export interface Session {
  userId: string;
  role: Role;
  name: string;
  /** גרסת ההתחברות של המשתמש כשהעוגייה נוצרה; עוגייה עם גרסה ישנה נדחית (יציאה מכל המכשירים, שינוי סיסמה) */
  v: number;
}

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // שבועיים

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  // בייצור אסור להשתמש בערך לדוגמה מהקובץ .env.example
  if (process.env.NODE_ENV === "production" && value.startsWith("change-me")) {
    throw new Error("SESSION_SECRET is still the example value; set a long random secret");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { userId, role, name, v } = payload as Partial<Session>;
    if (typeof userId !== "string" || typeof name !== "string") return null;
    if (role !== "CUSTOMER" && role !== "SUPPLIER" && role !== "ADMIN") return null;
    return { userId, role, name, v: typeof v === "number" ? v : 0 };
  } catch {
    return null;
  }
}

/** האזור במערכת שכל תפקיד נכנס אליו */
export const HOME_BY_ROLE: Record<Role, string> = {
  CUSTOMER: "/customer",
  SUPPLIER: "/supplier",
  ADMIN: "/admin",
};
