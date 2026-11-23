import type { NegotiationRequest } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { shekels } from "@/lib/format";
import { isCustomerProfile } from "@/lib/inquiries";

/**
 * קבלת הצעה של ספק: הפנייה נסגרת כ"התקבלה", פרטי הקשר נפתחים לספק והוא מקבל התראה.
 * כשאושרה מסגרת אשראי, ההתראה אומרת לספק שהלקוח רציני.
 */
export async function acceptInquiry(
  inquiry: Pick<NegotiationRequest, "id" | "supplierId">,
  businessName: string,
  hold?: { amountAgorot: number } | null,
) {
  await db.negotiationRequest.update({
    where: { id: inquiry.id },
    data: { outcome: "ACCEPTED", outcomeAt: new Date(), outcomeNote: null, status: "CLOSED" },
  });
  await notify([
    {
      supplierId: inquiry.supplierId,
      kind: "OFFER_DECIDED",
      title: `${businessName} קיבלו את ההצעה שלכם`,
      body: hold
        ? `הלקוח אישר את ההזמנה הראשונה עם מסגרת אשראי של ${shekels(hold.amountAgorot)}. פרטי הקשר פתוחים עכשיו בפנייה.`
        : "פרטי הקשר של הלקוח פתוחים עכשיו בפנייה. צרו קשר כדי לסגור את ההזמנה.",
      href: `/supplier/inquiries/${inquiry.id}`,
      dedupeKey: `offer-decided:inquiry:${inquiry.id}`,
    },
  ]);
  await audit({ action: "offer.accepted", targetType: "inquiry", targetId: inquiry.id });
}

/** מספר האספקות בחודש של הלקוח, לחישוב ההזמנה הראשונה */
export async function deliveriesFor(basketId: string | null, customerProfile: unknown): Promise<number> {
  if (basketId) {
    const basket = await db.basket.findUnique({ where: { id: basketId }, select: { deliveriesPerMonth: true } });
    if (basket) return basket.deliveriesPerMonth;
  }
  return isCustomerProfile(customerProfile) ? customerProfile.deliveriesPerMonth : 4;
}
