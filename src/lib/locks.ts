import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * מריץ פעולה בטרנזקציה עם נעילה לפי מפתח (למשל לקוח+ספק). שתי בקשות עם אותו מפתח רצות אחת אחרי השנייה,
 * כך ש"בדיקה ואז יצירה" (אין פנייה פתוחה? אז יוצרים) לא יוצרת כפילות כשלוחצים פעמיים או משתי לשוניות.
 */
export async function withLock<T>(key: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      return fn(tx);
    },
    { timeout: 20_000 },
  );
}
