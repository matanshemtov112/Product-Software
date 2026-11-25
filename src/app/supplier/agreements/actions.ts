"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { deniedMessage, requirePermission } from "@/lib/auth/permission-check";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { isActive } from "@/lib/guarantees";
import { notify } from "@/lib/notifications";
import { supplierForUser } from "@/lib/supplier/catalog";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface ChangeState {
  error?: string;
  sent?: boolean;
}

/**
 * הספק מבקש לשנות מחיר מובטח. המחיר לא משתנה עד שהלקוח מאשר; בקשה אחת פתוחה לכל מוצר.
 */
export async function requestGuaranteeChange(_: ChangeState, form: FormData): Promise<ChangeState> {
  const session = await requireRole("SUPPLIER");
  const denied = await deniedMessage("prices", session.userId);
  if (denied) return { error: denied };
  const supplier = await supplierForUser(session.userId);
  const lineId = String(form.get("lineId") ?? "");
  const line = await db.guaranteeLine.findFirst({
    where: { id: lineId, guarantee: { supplierId: supplier.id } },
    include: { guarantee: { include: { customer: { select: { businessName: true } } } } },
  });
  if (!line) return { error: "המוצר לא נמצא בעסקה" };
  if (!isActive(line.guarantee)) return { error: "תקופת ההבטחה הסתיימה, ואין מה לשנות" };
  const newAgorot = parseShekels(form.get("price"));
  if (newAgorot === null) return { error: "נא למלא מחיר חדש" };
  if (newAgorot === line.unitPriceAgorot) return { error: "זה המחיר המובטח הנוכחי" };
  const reason =
    String(form.get("reason") ?? "")
      .trim()
      .slice(0, 200) || null;
  const open = await db.guaranteeChange.findFirst({ where: { lineId, status: "PENDING" } });
  if (open) return { error: "כבר יש בקשה פתוחה על המוצר הזה. אפשר לבטל אותה ולשלוח חדשה." };
  const change = await db.guaranteeChange.create({
    data: { guaranteeId: line.guaranteeId, lineId, oldAgorot: line.unitPriceAgorot, newAgorot, reason },
  });
  await notify([
    {
      customerId: line.guarantee.customerId,
      aboutSupplierId: supplier.id,
      kind: "GUARANTEE_CHANGE_REQUESTED",
      title: `${supplier.companyName} מבקש לשנות את המחיר של ${line.productName}`,
      body: `מ-${shekels(line.unitPriceAgorot, 2)} ל-${shekels(newAgorot, 2)} ל${line.unitLabel}. בלי האישור שלכם המחיר לא משתנה.`,
      href: `/customer/agreements/${line.guaranteeId}`,
      dedupeKey: `guarantee-change:${change.id}`,
    },
  ]);
  await audit({
    action: "guarantee.change_requested",
    targetType: "guarantee",
    targetId: line.guaranteeId,
    details: { product: line.productName, from: line.unitPriceAgorot, to: newAgorot, reason },
  });
  revalidatePath(`/supplier/agreements/${line.guaranteeId}`);
  return { sent: true };
}

/** הספק מבטל בקשת שינוי שהלקוח עוד לא החליט עליה */
export async function withdrawGuaranteeChange(form: FormData) {
  const session = await requireRole("SUPPLIER");
  await requirePermission("prices", session.userId);
  const supplier = await supplierForUser(session.userId);
  const id = String(form.get("changeId") ?? "");
  const change = await db.guaranteeChange.findFirst({
    where: { id, status: "PENDING", guarantee: { supplierId: supplier.id } },
  });
  if (!change) redirect("/supplier/agreements");
  await db.guaranteeChange.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "WITHDRAWN", decidedAt: new Date() },
  });
  await audit({ action: "guarantee.change_withdrawn", targetType: "guarantee", targetId: change.guaranteeId });
  revalidatePath("/supplier", "layout");
  redirect(`/supplier/agreements/${change.guaranteeId}`);
}
