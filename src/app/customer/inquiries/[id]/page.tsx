import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { OfferButton, OfferReasonAction, OfferStatus } from "@/components/offer-actions";
import { QuoteTable } from "@/components/quote-table";
import { requireRole } from "@/lib/auth/current";
import { isDealSnapshot } from "@/lib/customer/deals";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { isQuoteSnapshot } from "@/lib/inquiries";
import { notify } from "@/lib/notifications";
import { canCancel, canDecide, inquiryStage, offerStageNote } from "@/lib/offer-status";
import { paymentTermsLabel } from "@/lib/terms";
import { cancelInquiry, decideInquiry } from "../../offers/actions";

export default async function CustomerInquiry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const inquiry = await db.negotiationRequest.findFirst({
    where: { id, customerId: customer.id },
    include: { supplier: { select: { companyName: true, contactPhone: true, contactEmail: true } } },
  });
  if (!inquiry) notFound();
  // פתיחת הצעה שנשלחה מסמנת אותה כ"נצפתה", והספק מקבל על זה התראה
  if (inquiryStage(inquiry) === "SENT") {
    inquiry.offerSeenAt = new Date();
    await db.negotiationRequest.update({ where: { id }, data: { offerSeenAt: inquiry.offerSeenAt } });
    await notify([
      {
        supplierId: inquiry.supplierId,
        kind: "OFFER_VIEWED",
        title: `${customer.businessName} צפו בהצעה שלכם`,
        href: `/supplier/inquiries/${id}`,
        dedupeKey: `offer-viewed:inquiry:${id}:${inquiry.repliedAt?.getTime()}`,
      },
    ]);
  }
  const stage = inquiryStage(inquiry);
  const deal = isDealSnapshot(inquiry.deal) ? inquiry.deal : null;
  const fields = { id: inquiry.id };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">פנייה ל{inquiry.supplier.companyName}</h1>
        <p className="text-sm text-muted">נשלחה {inquiry.createdAt.toLocaleDateString("he-IL")} · המחירים ללא מע״מ</p>
      </div>

      <OfferStatus stage={stage} note={offerStageNote(stage, "CUSTOMER", inquiry)}>
        {canDecide(stage) && (
          <>
            <OfferButton action={decideInquiry} fields={{ ...fields, decision: "ACCEPTED" }} label="קבלת ההצעה" />
            <OfferReasonAction
              action={decideInquiry}
              fields={{ ...fields, decision: "REJECTED" }}
              label="דחיית ההצעה"
              confirm="לדחות את ההצעה"
              placeholder="למה? למשל: המחיר עדיין גבוה (לא חובה)"
            />
          </>
        )}
        {canCancel(stage, "CUSTOMER") && (
          <OfferReasonAction
            action={cancelInquiry}
            fields={fields}
            label="ביטול הפנייה"
            confirm="לבטל את הפנייה"
            placeholder="למה? (לא חובה)"
          />
        )}
      </OfferStatus>

      {inquiry.reply && (
        <Card title="התשובה של הספק">
          <p className="whitespace-pre-line text-sm">{inquiry.reply}</p>
          <dl className="mt-3 flex flex-col gap-1 text-sm">
            {inquiry.paymentTermsDays !== null && (
              <div className="flex gap-2">
                <dt className="text-muted">תנאי תשלום שהספק הציע לכם:</dt>
                <dd>{paymentTermsLabel(inquiry.paymentTermsDays)}</dd>
              </div>
            )}
            {inquiry.status === "OFFERED" || inquiry.outcome === "ACCEPTED" || inquiry.outcome === "REJECTED" ? (
              <div className="flex gap-2">
                <dt className="text-muted">תוקף ההצעה:</dt>
                <dd>
                  {inquiry.validUntil ? `עד ${inquiry.validUntil.toLocaleDateString("he-IL")}` : "הספק לא קבע תוקף"}
                </dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="text-muted">נשלחה:</dt>
              <dd>{inquiry.repliedAt?.toLocaleDateString("he-IL")}</dd>
            </div>
          </dl>
          {stage === "ACCEPTED" && (inquiry.supplier.contactPhone || inquiry.supplier.contactEmail) && (
            <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm">
              ליצירת קשר עם הספק:{" "}
              {inquiry.supplier.contactPhone && (
                <a href={`tel:${inquiry.supplier.contactPhone}`} className="text-accent" dir="ltr">
                  {inquiry.supplier.contactPhone}
                </a>
              )}
              {inquiry.supplier.contactPhone && inquiry.supplier.contactEmail && " · "}
              {inquiry.supplier.contactEmail && (
                <a href={`mailto:${inquiry.supplier.contactEmail}`} className="text-accent" dir="ltr">
                  {inquiry.supplier.contactEmail}
                </a>
              )}
            </p>
          )}
        </Card>
      )}

      {deal ? (
        <Card title="המבצע שפניתם בעקבותיו">
          <p className="text-sm">
            <strong>{deal.productName}</strong> · {deal.dealText}
          </p>
        </Card>
      ) : (
        isQuoteSnapshot(inquiry.quote) && (
          <Card title={`ההצעה שקיבלתם מהמערכת: ${shekels(inquiry.totalAgorot)} לחודש`}>
            <QuoteTable quote={inquiry.quote} />
          </Card>
        )
      )}

      <Card title="ההודעה ששלחתם">
        <p className="whitespace-pre-line text-sm">{inquiry.message}</p>
      </Card>
    </div>
  );
}
