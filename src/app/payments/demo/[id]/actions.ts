"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { acceptInquiry } from "@/lib/customer/accept-inquiry";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { canDecide, inquiryStage } from "@/lib/offer-status";
import { DEMO_DECLINED_SUFFIX, holdExpiry, luhnValid, paymentsProvider } from "@/lib/payments/holds";
import { revalidatePath } from "next/cache";

export interface DemoCheckoutState {
  error?: string;
}

/**
 * דף התשלום לדוגמה: בודק את הכרטיס כמו שחברת סליקה הייתה בודקת, ושומר רק 4 ספרות אחרונות.
 * לא מתבצע חיוב ולא נשמרים פרטי כרטיס.
 */
export async function authorizeDemoHold(_: DemoCheckoutState, form: FormData): Promise<DemoCheckoutState> {
  if (paymentsProvider() !== "demo") return { error: "דף ההדגמה לא פעיל" };
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  const customer = await customerForUser(session.userId);
  const hold = await db.cardHold.findFirst({
    where: { id: String(form.get("holdId") ?? ""), customerId: customer.id, provider: "demo" },
    include: { inquiry: true },
  });
  if (!hold) return { error: "הבקשה לא נמצאה" };
  if (hold.status !== "PENDING" || !canDecide(inquiryStage(hold.inquiry))) {
    redirect(`/customer/inquiries/${hold.inquiryId}`);
  }

  const number = String(form.get("cardNumber") ?? "").replace(/\D/g, "");
  const expiry = String(form.get("expiry") ?? "").trim();
  const cvv = String(form.get("cvv") ?? "").trim();
  const holder = String(form.get("holderId") ?? "").replace(/\D/g, "");
  if (!luhnValid(number)) return { error: "מספר הכרטיס לא תקין" };
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
  const now = new Date();
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: "תוקף הכרטיס צריך להיות בצורה MM/YY" };
  const expiryEnd = new Date(2000 + Number(m[2]), Number(m[1]), 1);
  if (expiryEnd <= now) return { error: "תוקף הכרטיס עבר" };
  if (!/^\d{3,4}$/.test(cvv)) return { error: "נא למלא את 3 הספרות בגב הכרטיס" };
  if (!/^\d{5,9}$/.test(holder)) return { error: "נא למלא תעודת זהות של בעל הכרטיס" };

  if (number.endsWith(DEMO_DECLINED_SUFFIX)) {
    await db.cardHold.update({
      where: { id: hold.id },
      data: { status: "FAILED", failureReason: "הכרטיס נדחה", cardLast4: number.slice(-4) },
    });
    redirect(`/customer/inquiries/${hold.inquiryId}?hold=failed`);
  }

  await db.cardHold.update({
    where: { id: hold.id },
    data: {
      status: "AUTHORIZED",
      providerRef: `demo-${hold.id}`,
      cardLast4: number.slice(-4),
      authorizedAt: now,
      expiresAt: holdExpiry(now),
    },
  });
  await acceptInquiry(hold.inquiry, customer.businessName, hold);
  revalidatePath("/customer", "layout");
  redirect(`/customer/inquiries/${hold.inquiryId}?hold=ok`);
}
