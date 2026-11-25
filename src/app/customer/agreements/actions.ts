"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { isActive } from "@/lib/guarantees";
import { notify } from "@/lib/notifications";

/** הלקוח מאשר או דוחה בקשה של הספק לשנות מחיר מובטח. בלי אישור המחיר הקודם נשאר */
export async function decideGuaranteeChange(form: FormData) {
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  const customer = await customerForUser(session.userId);
  const id = String(form.get("changeId") ?? "");
  const approve = form.get("decision") === "APPROVED";
  const change = await db.guaranteeChange.findFirst({
    where: { id, status: "PENDING", guarantee: { customerId: customer.id } },
    include: { guarantee: true, line: true },
  });
  if (!change) redirect("/customer/agreements");
  const back = `/customer/agreements/${change.guaranteeId}`;
  if (!isActive(change.guarantee)) redirect(back);
  const now = new Date();
  await db.$transaction(async (tx) => {
    // רק אם הבקשה עוד ממתינה (לא אושרה בלשונית אחרת ולא בוטלה בינתיים)
    const updated = await tx.guaranteeChange.updateMany({
      where: { id, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "DECLINED", decidedAt: now },
    });
    if (updated.count && approve) {
      await tx.guaranteeLine.update({
        where: { id: change.lineId },
        data: { unitPriceAgorot: change.newAgorot, version: { increment: 1 } },
      });
    }
  });
  await notify([
    {
      supplierId: change.guarantee.supplierId,
      kind: "GUARANTEE_CHANGE_DECIDED",
      title: `${customer.businessName} ${approve ? "אישרו" : "לא אישרו"} את שינוי המחיר של ${change.line.productName}`,
      body: approve
        ? `המחיר המובטח עכשיו ${shekels(change.newAgorot, 2)} ל${change.line.unitLabel}.`
        : `המחיר המובטח נשאר ${shekels(change.oldAgorot, 2)} ל${change.line.unitLabel}.`,
      href: `/supplier/agreements/${change.guaranteeId}`,
      dedupeKey: `guarantee-change-decided:${id}`,
    },
  ]);
  await audit({
    action: approve ? "guarantee.change_approved" : "guarantee.change_declined",
    targetType: "guarantee",
    targetId: change.guaranteeId,
    details: { product: change.line.productName, from: change.oldAgorot, to: change.newAgorot },
  });
  revalidatePath("/customer", "layout");
  redirect(back);
}
