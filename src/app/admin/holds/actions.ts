"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { captureAtProvider, holdState, releaseAtProvider } from "@/lib/payments/holds";
import { parseShekels } from "@/lib/supplier/pricing-rules";

/** צוות הפלטפורמה משחרר מסגרת (למשל אחרי בירור עם הספק) */
export async function releaseHold(form: FormData) {
  await requireRole("ADMIN");
  const hold = await db.cardHold.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!hold || holdState(hold) !== "active" || !(await releaseAtProvider(hold))) return;
  await db.cardHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedAt: new Date() } });
  await audit({ action: "hold.released", targetType: "inquiry", targetId: hold.inquiryId, details: { by: "admin" } });
  revalidatePath("/admin/holds");
}

/** גביית דמי אי-הזמנה מתוך המסגרת, כשהלקוח קיבל הצעה ולא הזמין */
export async function captureHoldFee(form: FormData) {
  await requireRole("ADMIN");
  const hold = await db.cardHold.findUnique({ where: { id: String(form.get("id") ?? "") } });
  const amount = parseShekels(form.get("amount"));
  if (!hold || holdState(hold) !== "active" || !amount || amount > hold.amountAgorot) return;
  if (!(await captureAtProvider(hold, amount))) return;
  await db.cardHold.update({
    where: { id: hold.id },
    data: { status: "CAPTURED", capturedAgorot: amount, capturedAt: new Date() },
  });
  await audit({
    action: "hold.captured",
    targetType: "inquiry",
    targetId: hold.inquiryId,
    details: { amountAgorot: amount },
  });
  revalidatePath("/admin/holds");
}
