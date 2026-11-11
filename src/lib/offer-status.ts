import type { OfferOutcome, Role } from "@prisma/client";

// סטטוס אחד להצעת מחיר של ספק, גם בתשובה לפנייה וגם בתשובה לבקשת השוואה

export type OfferStage = "NEW" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export const OFFER_STAGE_LABEL: Record<OfferStage, string> = {
  NEW: "חדשה",
  SENT: "נשלחה",
  VIEWED: "נצפתה",
  ACCEPTED: "התקבלה",
  REJECTED: "נדחתה",
  EXPIRED: "פג תוקף",
  CANCELLED: "בוטלה",
};

export const OFFER_STAGE_STYLE: Record<OfferStage, string> = {
  NEW: "bg-[#e0ecff] text-[#1d4ed8]",
  SENT: "bg-[#fff4c2] text-[#6b5500]",
  VIEWED: "bg-[#efe4ff] text-[#6b21a8]",
  ACCEPTED: "bg-accent-soft text-accent",
  REJECTED: "bg-[#fde2e1] text-danger",
  EXPIRED: "bg-background text-muted",
  CANCELLED: "bg-background text-muted",
};

export interface OfferLike {
  /** מתי הספק שלח את ההצעה; null כשעוד לא ענה */
  offeredAt: Date | null;
  offerSeenAt: Date | null;
  outcome: OfferOutcome | null;
  validUntil: Date | null;
}

export function offerStage(o: OfferLike, now = new Date()): OfferStage {
  if (o.outcome) return o.outcome;
  if (!o.offeredAt) return "NEW";
  if (o.validUntil && o.validUntil < now) return "EXPIRED";
  return o.offerSeenAt ? "VIEWED" : "SENT";
}

/** הלקוח יכול לקבל או לדחות הצעה שנשלחה ועוד בתוקף */
export const canDecide = (stage: OfferStage) => stage === "SENT" || stage === "VIEWED";

/** הלקוח מבטל בקשה שעוד לא הסתיימה; הספק מושך הצעה שהלקוח עוד לא ענה עליה */
export function canCancel(stage: OfferStage, by: "CUSTOMER" | "SUPPLIER") {
  return by === "CUSTOMER" ? stage === "NEW" || canDecide(stage) : canDecide(stage);
}

/** הסבר קצר לסטטוס, מנקודת המבט של מי שצופה */
export function offerStageNote(
  stage: OfferStage,
  viewer: "CUSTOMER" | "SUPPLIER",
  o: { cancelledBy?: Role | null; outcomeNote?: string | null },
): string {
  const why = o.outcomeNote ? ` סיבה: ${o.outcomeNote}` : "";
  const mine = viewer === "CUSTOMER";
  switch (stage) {
    case "NEW":
      return mine ? "ממתינים להצעה מהספק." : "הלקוח ממתין להצעה שלכם.";
    case "SENT":
      return mine ? "הספק שלח הצעה. פתחו אותה והחליטו." : "ההצעה נשלחה. הלקוח עוד לא פתח אותה.";
    case "VIEWED":
      return mine ? "ראיתם את ההצעה. אפשר לקבל או לדחות." : "הלקוח פתח את ההצעה ועוד לא החליט.";
    case "ACCEPTED":
      return mine
        ? "קיבלתם את ההצעה. ההזמנה עצמה נעשית ישירות מול הספק."
        : "הלקוח קיבל את ההצעה. ההזמנה עצמה נעשית ישירות מולכם.";
    case "REJECTED":
      return (mine ? "דחיתם את ההצעה." : "הלקוח דחה את ההצעה.") + why;
    case "EXPIRED":
      return mine ? "תוקף ההצעה עבר. אפשר לשלוח לספק בקשה חדשה." : "תוקף ההצעה עבר לפני שהלקוח החליט.";
    case "CANCELLED": {
      const byCustomer = o.cancelledBy === "CUSTOMER";
      const who = byCustomer
        ? mine
          ? "ביטלתם את הבקשה."
          : "הלקוח ביטל את הבקשה."
        : mine
          ? "הספק ביטל את ההצעה."
          : "ביטלתם את ההצעה.";
      return who + why;
    }
  }
}

/** סיבה לדחייה או לביטול: טקסט קצר, או null */
export function parseOutcomeNote(value: FormDataEntryValue | null) {
  return (
    String(value ?? "")
      .trim()
      .slice(0, 300) || null
  );
}

type Common = Pick<OfferLike, "offerSeenAt" | "outcome" | "validUntil">;

/** סטטוס של תשובה לפנייה */
export const inquiryStage = (i: Common & { repliedAt: Date | null }, now = new Date()) =>
  offerStage({ ...i, offeredAt: i.repliedAt }, now);

/** סטטוס של תשובה לבקשת השוואה */
export const matchStage = (m: Common & { answeredAt: Date | null }, now = new Date()) =>
  offerStage({ ...m, offeredAt: m.answeredAt }, now);
