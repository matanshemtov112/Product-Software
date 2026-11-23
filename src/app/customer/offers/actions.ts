"use server";

import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { offeredPrice } from "@/lib/matches";
import { notify } from "@/lib/notifications";
import { acceptInquiry, deliveriesFor } from "@/lib/customer/accept-inquiry";
import { checkoutUrl, holdAmountAgorot, paymentsProvider } from "@/lib/payments/holds";
import { canCancel, canDecide, inquiryStage, matchStage, parseOutcomeNote } from "@/lib/offer-status";

async function currentCustomer() {
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  return customerForUser(session.userId);
}

/** הלקוח מקבל או דוחה את התשובה של ספק לפנייה. ההזמנה עצמה ממשיכה ישירות מול הספק */
export async function decideInquiry(form: FormData) {
  const customer = await currentCustomer();
  const id = String(form.get("id") ?? "");
  const decision = form.get("decision") === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  const inquiry = await db.negotiationRequest.findFirst({ where: { id, customerId: customer.id } });
  if (!inquiry || !canDecide(inquiryStage(inquiry))) redirect(`/customer/inquiries/${id}`);
  if (decision === "ACCEPTED") {
    // קבלת הצעה מתחילה בתפיסת מסגרת באשראי (סימן רצינות לספק), כשחברת סליקה מוגדרת
    const provider = paymentsProvider();
    if (!provider) {
      await acceptInquiry(inquiry, customer.businessName);
      revalidatePath("/customer", "layout");
      redirect(`/customer/inquiries/${id}`);
    }
    const deliveries = await deliveriesFor(inquiry.basketId, inquiry.customerProfile);
    const hold = await db.cardHold.create({
      data: {
        customerId: customer.id,
        supplierId: inquiry.supplierId,
        inquiryId: id,
        amountAgorot: holdAmountAgorot(inquiry.totalAgorot, deliveries),
        provider,
      },
    });
    redirect(checkoutUrl(hold));
  }
  const note = parseOutcomeNote(form.get("note"));
  await db.negotiationRequest.update({
    where: { id },
    data: { outcome: decision, outcomeAt: new Date(), outcomeNote: note, status: "CLOSED" },
  });
  await notify([
    {
      supplierId: inquiry.supplierId,
      kind: "OFFER_DECIDED",
      title: `${customer.businessName} דחו את ההצעה שלכם`,
      body: note ?? undefined,
      href: `/supplier/inquiries/${id}`,
      dedupeKey: `offer-decided:inquiry:${id}`,
    },
  ]);
  await audit({ action: "offer.rejected", targetType: "inquiry", targetId: id });
  revalidatePath("/customer", "layout");
  redirect(`/customer/inquiries/${id}`);
}

/** הלקוח מבטל פנייה שעוד לא הסתיימה */
export async function cancelInquiry(form: FormData) {
  const customer = await currentCustomer();
  const id = String(form.get("id") ?? "");
  const inquiry = await db.negotiationRequest.findFirst({ where: { id, customerId: customer.id } });
  if (!inquiry || !canCancel(inquiryStage(inquiry), "CUSTOMER")) redirect(`/customer/inquiries/${id}`);
  const note = parseOutcomeNote(form.get("note"));
  await db.negotiationRequest.update({
    where: { id },
    data: { outcome: "CANCELLED", cancelledBy: "CUSTOMER", outcomeAt: new Date(), outcomeNote: note, status: "CLOSED" },
  });
  await notify([
    {
      supplierId: inquiry.supplierId,
      kind: "OFFER_CANCELLED",
      title: `${customer.businessName} ביטלו את הפנייה`,
      body: note ?? undefined,
      href: `/supplier/inquiries/${id}`,
      dedupeKey: `offer-cancelled:inquiry:${id}`,
    },
  ]);
  await audit({ action: "offer.cancelled", targetType: "inquiry", targetId: id });
  revalidatePath("/customer", "layout");
  redirect(`/customer/inquiries/${id}`);
}

/** הלקוח דוחה את כל מה שנשאר פתוח בתשובה לבקשת השוואה */
export async function rejectMatch(form: FormData) {
  const customer = await currentCustomer();
  const id = String(form.get("id") ?? "");
  const request = await db.matchRequest.findFirst({ where: { id, customerId: customer.id }, include: { lines: true } });
  if (!request || !canDecide(matchStage(request))) redirect(`/customer/matches/${id}`);
  const note = parseOutcomeNote(form.get("note"));
  const accepted = request.lines.some((l) => l.decision === "ACCEPTED");
  const now = new Date();
  await db.$transaction([
    db.matchRequestLine.updateMany({
      where: { requestId: id, decision: "PENDING" },
      data: { decision: "REJECTED", decidedAt: now },
    }),
    db.matchRequest.update({
      where: { id },
      data: { outcome: accepted ? "ACCEPTED" : "REJECTED", outcomeAt: now, outcomeNote: note, status: "CLOSED" },
    }),
  ]);
  await notify([
    {
      supplierId: request.supplierId,
      kind: "MATCH_DECIDED",
      title: accepted
        ? `${customer.businessName} אישרו חלק מהמחירים בהצעה שלכם`
        : `${customer.businessName} דחו את ההצעה שלכם`,
      body: note ?? undefined,
      href: `/supplier/matches/${id}`,
      dedupeKey: `match-decided:${id}`,
    },
  ]);
  await audit({ action: "offer.rejected", targetType: "match", targetId: id });
  revalidatePath("/customer", "layout");
  redirect(`/customer/matches/${id}`);
}

/** הלקוח מבטל בקשת השוואה שעוד לא הסתיימה */
export async function cancelMatch(form: FormData) {
  const customer = await currentCustomer();
  const id = String(form.get("id") ?? "");
  const request = await db.matchRequest.findFirst({ where: { id, customerId: customer.id }, include: { lines: true } });
  if (!request || !canCancel(matchStage(request), "CUSTOMER")) redirect(`/customer/matches/${id}`);
  // בקשה שהלקוח כבר אישר בה מחירים לא מבטלים; דוחים את השאר
  if (request.lines.some((l) => l.decision === "ACCEPTED" && offeredPrice(l) !== null))
    redirect(`/customer/matches/${id}`);
  const note = parseOutcomeNote(form.get("note"));
  await db.matchRequest.update({
    where: { id },
    data: { outcome: "CANCELLED", cancelledBy: "CUSTOMER", outcomeAt: new Date(), outcomeNote: note, status: "CLOSED" },
  });
  await notify([
    {
      supplierId: request.supplierId,
      kind: "OFFER_CANCELLED",
      title: `${customer.businessName} ביטלו את בקשת ההשוואה`,
      body: note ?? undefined,
      href: `/supplier/matches/${id}`,
      dedupeKey: `offer-cancelled:match:${id}`,
    },
  ]);
  await audit({ action: "offer.cancelled", targetType: "match", targetId: id });
  revalidatePath("/customer", "layout");
  redirect(`/customer/matches/${id}`);
}
