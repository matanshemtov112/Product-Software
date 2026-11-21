import type { BlockMode } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { BLOCK_WINDOW_DAYS, BLOCKS_TO_FLAG } from "@/lib/notify/limits";

export async function blockOf(customerId: string, supplierId: string) {
  return (await db.supplierBlock.findUnique({ where: { customerId_supplierId: { customerId, supplierId } } }))?.mode;
}

export const BLOCKED_MESSAGE = "חסמתם את הספק הזה. אפשר לבטל את החסימה בדף הספק או בהגדרות ההתראות.";

/**
 * העסק משתיק או חוסם ספק.
 * השתקה: בלי התראות על מחירים, הזדמנויות ומבצעים של הספק; תשובות להצעות עדיין מגיעות.
 * חסימה: הספק לא מופיע בהשוואות, הפניות הפתוחות אליו מתבטלות, והוא לא יכול לענות.
 */
export async function setBlock(customerId: string, supplierId: string, mode: BlockMode | null, now = new Date()) {
  if (!mode) {
    await db.supplierBlock.deleteMany({ where: { customerId, supplierId } });
    return;
  }
  await db.supplierBlock.upsert({
    where: { customerId_supplierId: { customerId, supplierId } },
    create: { customerId, supplierId, mode },
    update: { mode, createdAt: now },
  });
  if (mode !== "BLOCK") return;

  const ended = {
    outcome: "CANCELLED" as const,
    cancelledBy: "CUSTOMER" as const,
    outcomeAt: now,
    status: "CLOSED" as const,
  };
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({ where: { customerId, supplierId, outcome: null }, select: { id: true } }),
    db.matchRequest.findMany({ where: { customerId, supplierId, outcome: null }, select: { id: true } }),
  ]);
  await db.negotiationRequest.updateMany({ where: { id: { in: inquiries.map((i) => i.id) } }, data: ended });
  await db.matchRequest.updateMany({ where: { id: { in: matches.map((m) => m.id) } }, data: ended });
  // הספק לא יודע שנחסם, רק שהפנייה בוטלה
  await notify([
    ...inquiries.map((i) => ({
      supplierId,
      kind: "OFFER_CANCELLED" as const,
      title: "לקוח ביטל פנייה",
      href: `/supplier/inquiries/${i.id}`,
      dedupeKey: `offer-cancelled:inquiry:${i.id}`,
    })),
    ...matches.map((m) => ({
      supplierId,
      kind: "OFFER_CANCELLED" as const,
      title: "לקוח ביטל בקשת השוואה",
      href: `/supplier/matches/${m.id}`,
      dedupeKey: `offer-cancelled:match:${m.id}`,
    })),
  ]);
  await flagIfBlockedOften(supplierId, now);
}

/** ספק שכמה עסקים חסמו בזמן קצר: דיווח לצוות הפלטפורמה לבדיקה (פעם אחת לכל תקופה) */
export async function flagIfBlockedOften(supplierId: string, now = new Date()) {
  const since = new Date(now.getTime() - BLOCK_WINDOW_DAYS * 86_400_000);
  const [count, supplier] = await Promise.all([
    db.supplierBlock.count({ where: { supplierId, mode: "BLOCK", createdAt: { gte: since } } }),
    db.supplier.findUnique({ where: { id: supplierId }, select: { companyName: true, blockFlaggedAt: true } }),
  ]);
  if (!supplier || count < BLOCKS_TO_FLAG) return false;
  if (supplier.blockFlaggedAt && supplier.blockFlaggedAt > since) return false;
  await db.abuseReport.create({
    data: {
      reporterUserId: "system",
      reporterName: "המערכת",
      targetType: "SUPPLIER",
      targetId: supplierId,
      targetName: supplier.companyName,
      reason: "SPAM",
      text: `${count} עסקים חסמו את הספק ב-${BLOCK_WINDOW_DAYS} הימים האחרונים. כדאי לבדוק אם הוא מציף לקוחות בפניות.`,
    },
  });
  await db.supplier.update({ where: { id: supplierId }, data: { blockFlaggedAt: now } });
  return true;
}
