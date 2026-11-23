"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { audit, clientIp } from "@/lib/audit";
import { db } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getSession } from "./current";
import { hashPassword, verifyPassword } from "./password";
import { HOME_BY_ROLE, SESSION_COOKIE, SESSION_MAX_AGE, type Session, signSession } from "./session";

export interface FormState {
  error?: string;
}

async function startSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

const loginSchema = z.object({
  kind: z.enum(["customer", "supplier"]),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "נא למלא אימייל וסיסמה" };
  const { email } = parsed.data;
  // הגבלה לפי אימייל (לא תלויה בכתובת, שאפשר לזייף) ובנוסף לפי כתובת.
  // הניסיון נספר לפני בדיקת הסיסמה, כך שגם ניסיונות רבים באותו רגע נעצרים במגבלה; כניסה מוצלחת מאפסת
  const key = `login:${email}`;
  const ipKey = `login-ip:${await clientIp()}`;
  if (rateLimit.blocked(ipKey, LIMITS.loginPerIp) || !rateLimit.hit(key, LIMITS.loginFailures)) {
    await audit({ action: "login.blocked", actor: email });
    return { error: `יותר מדי ניסיונות. נסו שוב בעוד ${rateLimit.retryMinutes(key, LIMITS.loginFailures)} דקות.` };
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    rateLimit.hit(ipKey, LIMITS.loginPerIp);
    await audit({ action: "login.failed", actor: email, userId: user?.id });
    return { error: "אימייל או סיסמה שגויים" };
  }
  rateLimit.reset(key);
  // הצד (מסעדה או ספק) נקבע לפי החשבון עצמו, ולא לפי הלשונית שנבחרה: כך כניסה עובדת גם אם הלשונית
  // נלחצה לפני שהדף סיים להיטען, וכל משתמש מגיע לאזור שלו
  await startSession({ userId: user.id, role: user.role, name: user.name });
  await audit({ action: "login.success", userId: user.id, actor: user.name });
  redirect(HOME_BY_ROLE[user.role]);
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/");
}

const accountFields = {
  name: z.string().trim().min(2, "שם קצר מדי"),
  email: z.string().trim().toLowerCase().email("אימייל לא תקין"),
  password: z.string().min(8, "סיסמה של 8 תווים לפחות"),
  phone: z.string().trim().optional(),
};

const customerSchema = z.object({
  ...accountFields,
  kind: z.literal("customer"),
  businessName: z.string().trim().min(2, "נא למלא שם עסק"),
  businessType: z.string().trim().min(2, "נא לבחור סוג עסק"),
  city: z.string().trim().min(2, "נא למלא עיר"),
  address: z.string().trim().max(120, "הכתובת ארוכה מדי").optional(),
  totalVolume: z.string().optional(),
  regionId: z.string().min(1, "נא לבחור אזור"),
  preference: z.enum(["PRICE", "BALANCED", "SERVICE"]),
});

const supplierSchema = z.object({
  ...accountFields,
  kind: z.literal("supplier"),
  companyName: z.string().trim().min(2, "נא למלא שם חברה"),
  companyNumber: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "ח.פ. צריך להיות 9 ספרות"),
});

/** היקף הרכש הכולל שנבחר בהרשמה, כשדות לשמירה */
function totalVolumeFields(key: string | undefined) {
  const range = VOLUME_RANGES.find((r) => r.key === key);
  return {
    totalVolumeMinAgorot: range ? range.min * 100 : null,
    totalVolumeMaxAgorot: range?.max ? range.max * 100 : null,
  };
}

const registerSchema = z.discriminatedUnion("kind", [customerSchema, supplierSchema]);

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const data = parsed.data;
  if (!rateLimit.hit(`register:${await clientIp()}`, LIMITS.register)) {
    return { error: "יותר מדי הרשמות מהכתובת הזו. נסו שוב מאוחר יותר." };
  }

  if (await db.user.findUnique({ where: { email: data.email } })) {
    return { error: "כבר קיים חשבון עם האימייל הזה" };
  }
  const passwordHash = await hashPassword(data.password);
  const account = { name: data.name, email: data.email, phone: data.phone || null, passwordHash };

  if (data.kind === "customer") {
    const user = await db.user.create({
      data: {
        ...account,
        role: "CUSTOMER",
        isManager: true,
        teamRole: "MANAGER",
        customer: {
          create: {
            businessName: data.businessName,
            businessType: data.businessType,
            city: data.city,
            address: data.address || null,
            ...totalVolumeFields(data.totalVolume),
            regionId: data.regionId,
            preference: data.preference,
          },
        },
      },
    });
    await startSession({ userId: user.id, role: user.role, name: user.name });
    await audit({
      action: "register",
      userId: user.id,
      actor: user.name,
      targetType: "customer",
      details: { email: user.email },
    });
    redirect(HOME_BY_ROLE.CUSTOMER);
  }

  if (await db.supplier.findUnique({ where: { companyNumber: data.companyNumber } })) {
    return { error: "ספק עם ח.פ. הזה כבר רשום" };
  }
  const user = await db.user.create({
    data: {
      ...account,
      role: "SUPPLIER",
      isManager: true,
      teamRole: "MANAGER",
      supplier: {
        create: {
          companyName: data.companyName,
          companyNumber: data.companyNumber,
          contactEmail: data.email,
          contactPhone: data.phone || null,
        },
      },
    },
  });
  await startSession({ userId: user.id, role: user.role, name: user.name });
  await audit({
    action: "register",
    userId: user.id,
    actor: user.name,
    targetType: "supplier",
    details: { email: user.email, companyNumber: data.companyNumber },
  });
  redirect(HOME_BY_ROLE.SUPPLIER);
}

const buyingSchema = z.object({
  businessType: z.string().trim().min(2, "נא לבחור סוג עסק").max(40),
  city: z.string().trim().min(2, "נא למלא עיר").max(60),
  address: z.string().trim().max(120, "הכתובת ארוכה מדי").optional(),
  regionId: z.string().min(1, "נא לבחור אזור"),
});

/**
 * מסחר בין ספקים: מנהל הספק פותח חשבון קנייה, כדי לקנות מספקים אחרים כמו כל עסק (למשל מפעל שקונה קמח).
 * שם העסק בחשבון הקנייה הוא שם הספק, והמשתמש עובר אליו מיד.
 */
export async function openBuyingAccount(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session || session.role !== "SUPPLIER") redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { supplier: { include: { buyingAccount: { select: { id: true } } } } },
  });
  if (!user?.supplier || user.role !== "SUPPLIER") redirect("/login");
  if (user.teamRole !== "MANAGER") return { error: "רק מנהל יכול לפתוח חשבון קנייה" };
  const parsed = buyingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  if (!(await db.region.findUnique({ where: { id: parsed.data.regionId } }))) return { error: "נא לבחור אזור" };
  const supplier = user.supplier;
  const account =
    supplier.buyingAccount ??
    (await db.customer.create({
      data: {
        businessName: supplier.companyName,
        businessType: parsed.data.businessType,
        city: parsed.data.city,
        address: parsed.data.address || null,
        regionId: parsed.data.regionId,
        // לא מסעדה: מדלגים על בחירת סוג המסעדה (רשימה סטנדרטית של "אחר")
        cuisine: "אחר",
        ownerSupplierId: supplier.id,
      },
      select: { id: true },
    }));
  await audit({
    action: "buying.opened",
    userId: user.id,
    actor: user.name,
    targetType: "customer",
    targetId: account.id,
  });
  return enterSide(user.id, user.name, "CUSTOMER", account.id);
}

/** מעבר בין צד המכירה (ספק) לצד הקנייה (חשבון הקנייה של אותו ספק) */
export async function switchSide() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { supplier: { select: { buyingAccount: { select: { id: true } } } } },
  });
  if (!user?.supplierId || user.role === "ADMIN") redirect("/login");
  if (user.role === "SUPPLIER") {
    const account = user.supplier?.buyingAccount;
    if (!account) redirect("/supplier/buying");
    await enterSide(user.id, user.name, "CUSTOMER", account.id);
  }
  await enterSide(user.id, user.name, "SUPPLIER", user.customerId);
}

async function enterSide(
  userId: string,
  name: string,
  role: "CUSTOMER" | "SUPPLIER",
  customerId: string | null,
): Promise<never> {
  await db.user.update({ where: { id: userId }, data: { role, customerId } });
  await startSession({ userId, role, name });
  await audit({ action: "side.switched", userId, actor: name, details: { to: role } });
  redirect(HOME_BY_ROLE[role]);
}
