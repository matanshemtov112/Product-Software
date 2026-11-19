"use server";

import type { NotificationCategory, NotificationFrequency } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { CATEGORIES, EMAIL_OPTIONS } from "./categories";
import { setMarketingConsent } from "./consent";

export interface PrefsState {
  saved?: boolean;
  error?: string;
}

/** כל משתמש קובע לעצמו אילו התראות לקבל ואיך. התראות חשובות תמיד נשלחות */
export async function savePrefs(_: PrefsState, form: FormData): Promise<PrefsState> {
  const session = await getSession();
  if (!session || session.role === "ADMIN") return { error: "אין הרשאה" };
  for (const category of CATEGORIES) {
    if (category === "CRITICAL") continue;
    const email = String(form.get(`email_${category}`) ?? "") as NotificationFrequency;
    if (!EMAIL_OPTIONS[category].includes(email)) return { error: "בחירה לא תקינה" };
    const inApp = form.get(`inApp_${category}`) === "on";
    await db.notificationPreference.upsert({
      where: { userId_category: { userId: session.userId, category: category as NotificationCategory } },
      create: { userId: session.userId, category, inApp, email },
      update: { inApp, email },
    });
    // בחירה באימיילים שיווקיים בהגדרות היא הסכמה מפורשת; ביטול הבחירה מבטל אותה
    if (category === "MARKETING") await setMarketingConsent(session.userId, email !== "OFF", "settings");
  }
  await audit({ action: "notifications.updated", targetType: "user", targetId: session.userId });
  revalidatePath(session.role === "CUSTOMER" ? "/customer" : "/supplier", "layout");
  return { saved: true };
}
