import type { MatchResponse } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { offeredPrice } from "@/lib/matches";
import { notify } from "@/lib/notifications";
import { MAX_REPLIES, REPLY_LIMIT_MESSAGE } from "@/lib/notify/limits";

/**
 * שליחת תשובה של ספק לפנייה ולבקשת השוואה. משותף לטופס באזור הספק ולעוזר ה-AI:
 * שני המסלולים עוברים את אותן בדיקות, כותבים את אותם שדות ושולחים את אותן התראות.
 * את ההרשאה (תפקיד "מענה") בודק מי שקורא לפונקציה.
 */

export const NO_MATCH_NOTE = "הספק לא יכול להתאים את המחיר";

export type SendResult = { ok: true } | { ok: false; error: string };

interface SupplierRef {
  id: string;
  companyName: string;
}

export interface InquiryReplyInput {
  inquiryId: string;
  reply: string;
  /** OFFERED: הצעה ללקוח. CLOSED: "לא נוכל להתאים", סוגר את הפנייה */
  status: "OFFERED" | "CLOSED";
  /** שוטף + ימים (0 = מזומן); null = לא צוין */
  paymentTermsDays: number | null;
  /** עד מתי ההצעה בתוקף; null = בלי תוקף */
  validUntil: Date | null;
  /** מי שלח: הטופס או העוזר (נרשם ביומן) */
  via?: "form" | "assistant";
}

export async function sendInquiryReply(supplier: SupplierRef, input: InquiryReplyInput): Promise<SendResult> {
  const reply = input.reply.trim();
  if (reply.length < 2) return { ok: false, error: "נא לכתוב תשובה ללקוח" };
  if (reply.length > 1000) return { ok: false, error: "התשובה ארוכה מדי (עד 1,000 תווים)" };
  const inquiry = await db.negotiationRequest.findFirst({ where: { id: input.inquiryId, supplierId: supplier.id } });
  if (!inquiry) return { ok: false, error: "הפנייה לא נמצאה" };
  if (inquiry.outcome) return { ok: false, error: "הפנייה כבר הסתיימה, ואי אפשר לשלוח עליה הצעה" };
  if (inquiry.replyCount >= MAX_REPLIES) return { ok: false, error: REPLY_LIMIT_MESSAGE };
  const now = new Date();
  const { status } = input;
  await db.negotiationRequest.update({
    where: { id: inquiry.id },
    data: {
      reply,
      status,
      paymentTermsDays: input.paymentTermsDays,
      validUntil: status === "OFFERED" ? input.validUntil : null,
      repliedAt: now,
      replyCount: { increment: 1 },
      // הצעה מעודכנת עוד לא נצפתה; "לא נוכל להתאים" סוגר את הפנייה
      offerSeenAt: null,
      ...(status === "CLOSED"
        ? {
            outcome: "CANCELLED" as const,
            cancelledBy: "SUPPLIER" as const,
            outcomeAt: now,
            outcomeNote: NO_MATCH_NOTE,
          }
        : {}),
    },
  });
  await notify([
    {
      customerId: inquiry.customerId,
      aboutSupplierId: supplier.id,
      kind: "SUPPLIER_REPLIED",
      title: inquiry.replyCount
        ? `${supplier.companyName} עדכן את התשובה לפנייה שלכם`
        : `${supplier.companyName} השיב לפנייה שלכם`,
      body: reply.length > 140 ? `${reply.slice(0, 140)}…` : reply,
      href: `/customer/inquiries/${inquiry.id}`,
    },
  ]);
  await audit({
    action: "inquiry.replied",
    targetType: "inquiry",
    targetId: inquiry.id,
    ...(input.via === "assistant" ? { details: { via: "assistant" } } : {}),
  });
  return { ok: true };
}

export interface MatchLineAnswer {
  response: Exclude<MatchResponse, "PENDING">;
  /** בהצעה נגדית: המחיר ליחידה באגורות, ללא מע״מ */
  counterAgorot: number | null;
}

export interface MatchAnswerInput {
  requestId: string;
  /** תשובה לכל מוצר שעוד ממתין, לפי מזהה השורה */
  lines: Record<string, MatchLineAnswer | undefined>;
  note: string | null;
  validUntil: Date | null;
  paymentTermsDays: number | null;
  via?: "form" | "assistant";
}

/**
 * תשובת הספק לבקשת השוואה: לכל מוצר השוואה, הצעה נגדית או סירוב.
 * הצעה נגדית חייבת להיות נמוכה מהמחיר שהלקוח משלם היום. המחירים חלים על הלקוח הזה בלבד.
 */
export async function sendMatchAnswer(supplier: SupplierRef, input: MatchAnswerInput): Promise<SendResult> {
  const request = await db.matchRequest.findFirst({
    where: { id: input.requestId, supplierId: supplier.id },
    include: { lines: true },
  });
  if (!request) return { ok: false, error: "הבקשה לא נמצאה" };
  if (request.status === "CLOSED" || request.outcome) return { ok: false, error: "הבקשה כבר הסתיימה" };
  if (request.answerCount >= MAX_REPLIES) return { ok: false, error: REPLY_LIMIT_MESSAGE };
  const updates = [];
  for (const line of request.lines) {
    if (line.decision !== "PENDING") continue;
    const answer = input.lines[line.id];
    if (!answer) return { ok: false, error: `נא לבחור תשובה ל"${line.productName}"` };
    const { response } = answer;
    // ב"מתחת לסף" אין "משווה": הספק לא ראה את המחיר שנמצא
    if (request.reveal === "CEILING" && response === "MATCHED")
      return { ok: false, error: `נא לרשום את המחיר שלכם ל"${line.productName}"` };
    let counter: number | null = null;
    if (response === "COUNTER") {
      counter = answer.counterAgorot;
      if (counter === null || !Number.isInteger(counter) || counter <= 0)
        return { ok: false, error: `נא למלא מחיר להצעה הנגדית ל"${line.productName}"` };
      if (counter >= line.currentPriceAgorot)
        return { ok: false, error: `ההצעה ל"${line.productName}" צריכה להיות נמוכה מהמחיר שהלקוח משלם היום` };
    }
    // הצעה נגדית בדיוק במחיר המבוקש היא השוואה. ב"מתחת לסף" הספק לא ראה את המחיר, ולכן ההצעה נשארת שלו
    const same = request.reveal === "EXACT" && counter === line.targetPriceAgorot;
    updates.push(
      db.matchRequestLine.update({
        where: { id: line.id },
        data: { response: same ? "MATCHED" : response, counterPriceAgorot: same ? null : counter },
      }),
    );
  }
  // סירוב לכל המוצרים (בלי מחיר שאושר קודם) סוגר את הבקשה כ"בוטלה" מצד הספק
  const offersAny = request.lines.some((l) =>
    l.decision === "PENDING" ? input.lines[l.id]?.response !== "DECLINED" : offeredPrice(l) !== null,
  );
  const note = input.note?.trim().slice(0, 1000) || null;
  const now = new Date();
  await db.$transaction([
    ...updates,
    db.matchRequest.update({
      where: { id: request.id },
      data: {
        status: "ANSWERED",
        supplierNote: note,
        validUntil: input.validUntil,
        paymentTermsDays: input.paymentTermsDays,
        answeredAt: now,
        answerCount: { increment: 1 },
        offerSeenAt: null,
        ...(offersAny
          ? {}
          : {
              outcome: "CANCELLED" as const,
              cancelledBy: "SUPPLIER" as const,
              outcomeAt: now,
              outcomeNote: NO_MATCH_NOTE,
            }),
      },
    }),
  ]);
  await notify([
    {
      customerId: request.customerId,
      aboutSupplierId: supplier.id,
      kind: "MATCH_ANSWERED",
      title: request.answerCount
        ? `${supplier.companyName} עדכן את התשובה לבקשת ההשוואה שלכם`
        : `${supplier.companyName} השיב לבקשת ההשוואה שלכם`,
      body: "אשרו או דחו את המחירים שהספק הציע.",
      href: `/customer/matches/${request.id}`,
    },
  ]);
  await audit({
    action: "match.answered",
    targetType: "match",
    targetId: request.id,
    ...(input.via === "assistant" ? { details: { via: "assistant" } } : {}),
  });
  return { ok: true };
}
