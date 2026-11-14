import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { penalized, STAGE_MESSAGE, violationStage, windowStart } from "@/lib/price-violations";

/** דיווחים שנספרים: מהחלון האחרון, ולא כאלה שמנהל ביטל */
export const activeViolationsWhere = (supplierId: string, now = new Date()): Prisma.PriceViolationReportWhereInput => ({
  supplierId,
  status: { not: "DISMISSED" },
  createdAt: { gte: windowStart(now) },
});

/**
 * מעדכן את השלב של הספק לפי הדיווחים הפעילים, ומפעיל את מה שהשלב מחייב:
 * הודעה לספק (שלב 2), הורדת אמינות (שלב 3) והשעיה (שלב 4). כשהשלב יורד (מנהל ביטל דיווחים),
 * האמינות וההשעיה חוזרות למה שהיו.
 */
export async function syncViolationStage(supplierId: string, now = new Date()) {
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return;
  const count = await db.priceViolationReport.count({ where: activeViolationsWhere(supplierId, now) });
  const stage = violationStage(count);
  const prev = supplier.violationStage;
  if (stage === prev) return;

  const data: Prisma.SupplierUpdateInput = { violationStage: stage };
  if (stage >= 3 && prev < 3) {
    data.reliabilityBeforePenalty = supplier.reliability;
    data.reliability = penalized(supplier.reliability);
  }
  if (stage < 3 && prev >= 3 && supplier.reliabilityBeforePenalty !== null) {
    data.reliability = supplier.reliabilityBeforePenalty;
    data.reliabilityBeforePenalty = null;
  }
  if (stage >= 4 && prev < 4 && supplier.status === "APPROVED") data.status = "SUSPENDED";
  const lifted = stage < 4 && prev >= 4 && supplier.status === "SUSPENDED";
  if (lifted) data.status = "APPROVED";
  await db.supplier.update({ where: { id: supplierId }, data });

  // הודעה רק על השלב הגבוה שהגיע אליו עכשיו
  if (stage > prev && stage >= 2) {
    const message = STAGE_MESSAGE[stage as 2 | 3 | 4];
    await notify([
      { supplierId, kind: "PRICE_VIOLATION", title: message.title, body: message.body, href: "/supplier" },
    ]);
  }
  if (lifted) {
    await notify([
      {
        supplierId,
        kind: "ACCOUNT_STATUS",
        title: "ההשעיה הוסרה, ואתם שוב מופיעים ללקוחות",
        body: "צוות הפלטפורמה בדק את הדיווחים על הפרת מחיר. הקפידו שהמחירים במערכת יתאימו למה שאתם גובים.",
        href: "/supplier",
      },
    ]);
  }
  await audit({
    action: "supplier.violation_stage",
    targetType: "supplier",
    targetId: supplierId,
    details: { from: prev, to: stage, activeReports: count, supplier: supplier.companyName },
  });
}
