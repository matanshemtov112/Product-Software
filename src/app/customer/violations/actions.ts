"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { supplierPriceList } from "@/lib/customer/catalog";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { REPEAT_REPORT_DAYS, VIOLATION_WINDOW_DAYS, windowStart } from "@/lib/price-violations";
import { syncViolationStage } from "@/lib/price-violations-sync";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface ViolationFormState {
  error?: string;
  sent?: boolean;
}

/** לקוח מדווח שספק גבה ממנו מחיר גבוה מהמחיר שהופיע במערכת או שסוכם */
export async function reportPriceViolation(_: ViolationFormState, form: FormData): Promise<ViolationFormState> {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const supplierId = String(form.get("supplierId") ?? "");

  // רק לקוח שעובד עם הספק, או שפנה אליו, יכול לדווח עליו
  const related =
    (await mySuppliers(customer.id)).some((s) => s.supplierId === supplierId) ||
    (await db.negotiationRequest.count({ where: { customerId: customer.id, supplierId } })) > 0 ||
    (await db.matchRequest.count({ where: { customerId: customer.id, supplierId } })) > 0;
  if (!related) return { error: "אפשר לדווח רק על ספק שאתם עובדים איתו או שפניתם אליו" };

  const list = await supplierPriceList(supplierId);
  const item = list?.items.find((i) => i.product.id === String(form.get("productId") ?? ""));
  if (!list || !item) return { error: "נא לבחור מוצר מהרשימה" };
  const shown = parseShekels(form.get("shownPrice"));
  const charged = parseShekels(form.get("chargedPrice"));
  if (shown === null) return { error: "נא לרשום את המחיר שהופיע במערכת או שסוכם" };
  if (charged === null) return { error: "נא לרשום את המחיר שנגבה בפועל" };
  if (charged <= shown) return { error: "המחיר שנגבה צריך להיות גבוה מהמחיר שהופיע במערכת" };
  const occurredOn = new Date(String(form.get("occurredOn") ?? ""));
  const now = new Date();
  if (Number.isNaN(occurredOn.getTime()) || occurredOn > now || occurredOn < windowStart(now)) {
    return { error: `נא לבחור תאריך אספקה מ-${VIOLATION_WINDOW_DAYS} הימים האחרונים` };
  }
  const repeat = await db.priceViolationReport.findFirst({
    where: {
      customerId: customer.id,
      supplierId,
      productId: item.product.id,
      createdAt: { gte: windowStart(now, REPEAT_REPORT_DAYS) },
    },
  });
  if (repeat) return { error: `כבר דיווחתם על המוצר הזה אצל הספק ב-${REPEAT_REPORT_DAYS} הימים האחרונים` };
  if (!rateLimit.hit(`violation:${customer.id}`, LIMITS.reports)) {
    return { error: "שלחתם הרבה דיווחים היום. נסו שוב מחר." };
  }
  const text =
    String(form.get("text") ?? "")
      .trim()
      .slice(0, 500) || null;
  const report = await db.priceViolationReport.create({
    data: {
      supplierId,
      customerId: customer.id,
      productId: item.product.id,
      productName: item.product.name,
      unit: UNIT_LABEL[item.product.unit] ?? item.product.unit,
      shownPriceAgorot: shown,
      chargedPriceAgorot: charged,
      occurredOn,
      text,
    },
  });
  await audit({
    action: "violation.reported",
    targetType: "supplier",
    targetId: supplierId,
    details: { reportId: report.id, product: item.product.name, shown, charged, supplier: list.name },
  });
  await syncViolationStage(supplierId, now);
  revalidatePath("/admin", "layout");
  return { sent: true };
}
