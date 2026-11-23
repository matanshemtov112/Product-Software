import { db } from "@/lib/db";

/**
 * הכנה למנויים. בתקופת ההשקה המערכת חינמית לכולם: כל עוד PAYWALL_ACTIVE לא מוגדר ל-"1",
 * כל האפשרויות פתוחות לכל ספק. כשמפעילים תשלום, אפשרות שמסומנת כאן כ"למנויים" נפתחת רק לספק
 * עם מנוי פעיל (טבלת Subscription: plan מהרשימה, renewsAt בעתיד או ריק).
 */
export const FEATURES = {
  /** ביקוש באזור: אילו מוצרים עסקים באזור מחפשים */
  demandInsights: { label: "ביקוש באזור", plans: ["Pro", "Enterprise"] },
} as const;

export type Feature = keyof typeof FEATURES;

export function paywallActive(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYWALL_ACTIVE === "1";
}

export interface SubscriptionRow {
  plan: string;
  renewsAt: Date | null;
}

/** האם לספק יש גישה לאפשרות (פונקציה טהורה, לבדיקות) */
export function allows(feature: Feature, subscriptions: SubscriptionRow[], active: boolean, now = new Date()): boolean {
  if (!active) return true;
  const plans: readonly string[] = FEATURES[feature].plans;
  return subscriptions.some((s) => plans.includes(s.plan) && (s.renewsAt === null || s.renewsAt > now));
}

export async function supplierCanUse(supplierId: string, feature: Feature, now = new Date()): Promise<boolean> {
  if (!paywallActive()) return true;
  const subscriptions = await db.subscription.findMany({
    where: { supplierId },
    select: { plan: true, renewsAt: true },
  });
  return allows(feature, subscriptions, true, now);
}
