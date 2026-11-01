"use server";

import type { ReportReason } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { REPORT_REASON_LABEL } from "@/lib/reports";

export interface ReportFormState {
  error?: string;
  sent?: boolean;
}

/**
 * דיווח על ספק (מלקוח) או על לקוח (מספק). ספק יכול לדווח רק על לקוח שפנה אליו.
 * הדיווח מגיע לצוות הפלטפורמה; הצד המדווח לא רואה אותו.
 */
export async function createReport(_: ReportFormState, form: FormData): Promise<ReportFormState> {
  const session = await getSession();
  if (!session || session.role === "ADMIN") return { error: "אין הרשאה" };
  const reason = String(form.get("reason") ?? "") as ReportReason;
  if (!(reason in REPORT_REASON_LABEL)) return { error: "נא לבחור סיבה" };
  const text =
    String(form.get("text") ?? "")
      .trim()
      .slice(0, 1000) || null;
  if (reason === "OTHER" && !text) return { error: "נא לכתוב במה מדובר" };
  const targetId = String(form.get("targetId") ?? "");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "אין הרשאה" };

  let target: { type: "SUPPLIER" | "CUSTOMER"; name: string } | null = null;
  if (session.role === "CUSTOMER") {
    const supplier = await db.supplier.findUnique({ where: { id: targetId } });
    if (supplier) target = { type: "SUPPLIER", name: supplier.companyName };
  } else if (user.supplierId) {
    const contacted = await db.customer.findFirst({
      where: {
        id: targetId,
        OR: [
          { negotiations: { some: { supplierId: user.supplierId } } },
          { matchRequests: { some: { supplierId: user.supplierId } } },
        ],
      },
    });
    if (contacted) target = { type: "CUSTOMER", name: contacted.businessName };
  }
  if (!target) return { error: "לא נמצא מה לדווח עליו" };
  if (!rateLimit.hit(`report:${user.id}`, LIMITS.reports)) return { error: "שלחתם הרבה דיווחים היום. נסו שוב מחר." };

  const report = await db.abuseReport.create({
    data: {
      reporterUserId: user.id,
      reporterName: user.name,
      targetType: target.type,
      targetId,
      targetName: target.name,
      reason,
      text,
      path: String(form.get("path") ?? "").slice(0, 200) || null,
    },
  });
  await audit({
    action: "report.created",
    targetType: target.type.toLowerCase(),
    targetId,
    details: { reportId: report.id, reason, target: target.name },
  });
  revalidatePath("/admin", "layout");
  return { sent: true };
}
