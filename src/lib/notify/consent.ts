import type { NotificationCategory } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

/**
 * הסכמה לקבל דבר פרסומת באימייל (חוק התקשורת, סעיף 30א).
 * נרשם מתי ואיך ניתנה ההסכמה, ומתי בוטלה, כדי שאפשר יהיה להוכיח אותה.
 */
export async function setMarketingConsent(userId: string, on: boolean, source: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { marketingConsentAt: true } });
  if (!user || Boolean(user.marketingConsentAt) === on) return;
  await db.user.update({
    where: { id: userId },
    data: on
      ? { marketingConsentAt: new Date(), marketingConsentSource: source }
      : { marketingConsentAt: null, marketingConsentSource: null },
  });
  await audit({
    action: on ? "marketing.consent_given" : "marketing.consent_withdrawn",
    targetType: "user",
    targetId: userId,
    userId,
    details: { source },
  });
}

/** הסרה מקישור באימייל: מפסיק את האימיילים מהקבוצה, ובפרסומת גם מבטל את ההסכמה ומסתיר את ההודעות */
export async function unsubscribe(userId: string, category: NotificationCategory) {
  const marketing = category === "MARKETING";
  await db.notificationPreference.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, email: "OFF", inApp: !marketing },
    update: marketing ? { email: "OFF", inApp: false } : { email: "OFF" },
  });
  if (marketing) await setMarketingConsent(userId, false, "unsubscribe-link");
  else
    await audit({
      action: "notifications.unsubscribed",
      targetType: "user",
      targetId: userId,
      userId,
      details: { category },
    });
}
