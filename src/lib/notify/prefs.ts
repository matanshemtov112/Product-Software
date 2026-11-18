import { cache } from "react";
import { db } from "@/lib/db";
import { hiddenCategories } from "./categories";

/** ההעדפות ששמר המשתמש (קבוצות בלי שורה מקבלות ברירת מחדל) */
export const savedPrefs = cache(async (userId: string) => db.notificationPreference.findMany({ where: { userId } }));

/** תנאי לשאילתת התראות: בלי הקבוצות שהמשתמש כיבה במערכת */
export async function visibleFilter(userId: string) {
  const hidden = hiddenCategories(await savedPrefs(userId));
  return hidden.length ? { category: { notIn: hidden } } : {};
}
