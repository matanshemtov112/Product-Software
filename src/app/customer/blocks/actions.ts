"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { setBlock } from "@/lib/supplier-blocks";

/** השתקה, חסימה או ביטול שלהן. mode: MUTE / BLOCK / NONE */
export async function updateSupplierBlock(form: FormData) {
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  const customer = await customerForUser(session.userId);
  const supplierId = String(form.get("supplierId") ?? "");
  const raw = String(form.get("mode") ?? "");
  const mode = raw === "MUTE" || raw === "BLOCK" ? raw : null;
  if (!(await db.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }))) return;
  await setBlock(customer.id, supplierId, mode);
  await audit({
    action: mode === "BLOCK" ? "supplier.blocked" : mode === "MUTE" ? "supplier.muted" : "supplier.unblocked",
    targetType: "supplier",
    targetId: supplierId,
  });
  revalidatePath("/customer", "layout");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/customer/") ? back : "/customer/notifications/settings");
}
