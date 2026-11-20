"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";

/** סיום מבצע כמות לפני הזמן. המחיר הרגיל נשאר כמו שהוא */
export async function endDeal(form: FormData) {
  const session = await requireRole("SUPPLIER");
  await requirePermission("prices", session.userId);
  const supplier = await supplierForUser(session.userId);
  const offerId = String(form.get("offerId") ?? "");
  const offer = await db.supplierOffer.findFirst({
    where: { id: offerId, supplierId: supplier.id },
    select: { id: true, quantityDeal: { select: { id: true } } },
  });
  if (offer?.quantityDeal) {
    await db.quantityDeal.delete({ where: { offerId: offer.id } });
    await audit({ action: "deal.removed", targetType: "offer", targetId: offer.id });
  }
  revalidatePath("/supplier", "layout");
  redirect("/supplier/deals?ended=1");
}
