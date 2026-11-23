import { SupplierBlockControl } from "@/components/supplier-block-control";
import { EndedOfferActions } from "@/components/ended-offer-actions";
import { QuoteValidity } from "@/components/quote-validity";
import { newInquiryHref, recheckHref } from "@/lib/customer/offer-links";
import { VerifiedBadge } from "@/components/verified-badge";
import Link from "next/link";
import { HOLD_STATE_LABEL, holdAmountAgorot, holdState, holdsEnabled } from "@/lib/payments/holds";
import { deliveriesFor } from "@/lib/customer/accept-inquiry";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { OfferButton, OfferReasonAction, OfferStatus } from "@/components/offer-actions";
import { QuoteTable } from "@/components/quote-table";
import { PriceViolationButton } from "@/components/report/price-violation-button";
import { violationProducts } from "@/lib/customer/violation-products";
import { requireRole } from "@/lib/auth/current";
import { isDealSnapshot } from "@/lib/customer/deals";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { isQuoteSnapshot } from "@/lib/inquiries";
import { notify } from "@/lib/notifications";
import { canCancel, canDecide, inquiryStage, offerStageNote, ENDED_STAGES } from "@/lib/offer-status";
import { paymentTermsLabel } from "@/lib/terms";
import { cancelInquiry, decideInquiry } from "../../offers/actions";

export default async function CustomerInquiry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hold?: string }>;
}) {
  const { id } = await params;
  const { hold: holdResult } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const inquiry = await db.negotiationRequest.findFirst({
    where: { id, customerId: customer.id, customerDeletedAt: null },
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
  const reportable = stage === "ACCEPTED" ? await violationProducts(inquiry.supplierId) : [];
  const basketIds = new Set(
    (await db.basket.findMany({ where: { customerId: customer.id }, select: { id: true } })).map((b) => b.id),
  );
  const ended = ENDED_STAGES.includes(stage);
  // תפיסת מסגרת באשראי: האחרונה שאושרה, וגובה המסגרת שתתבקש לפני קבלת ההצעה
  const hold = await db.cardHold.findFirst({
    where: { inquiryId: inquiry.id, status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
  });
  const holdBefore =
    canDecide(stage) && holdsEnabled()
      ? holdAmountAgorot(inquiry.totalAgorot, await deliveriesFor(inquiry.basketId, inquiry.customerProfile))
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">
          פנייה ל{inquiry.supplier.companyName}
          <VerifiedBadge supplierId={inquiry.supplierId} />
        </h1>
        <p className="text-sm text-muted">נשלחה {inquiry.createdAt.toLocaleDateString("he-IL")} · המחירים ללא מע״מ</p>
      </div>

      {holdResult === "failed" && (
        <p role="alert" className="rounded-md border border-danger bg-[#fdecec] px-4 py-3 text-sm">
          אישור המסגרת באשראי נכשל{hold?.failureReason ? ` (${hold.failureReason})` : ""}, וההצעה עוד לא התקבלה. אפשר
          לנסות שוב עם כרטיס אחר.
        </p>
      )}
      {hold && hold.status !== "FAILED" && stage === "ACCEPTED" && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          {holdState(hold) === "active"
            ? `אישרתם את ההזמנה הראשונה עם מסגרת אשראי של ${shekels(hold.amountAgorot)}${hold.cardLast4 ? ` (כרטיס ${hold.cardLast4}••••)` : ""}. לא בוצע חיוב. המסגרת משתחררת כשהספק מאשר שההזמנה סופקה, ולכל המאוחר ב-${hold.expiresAt?.toLocaleDateString("he-IL")}.`
            : `מסגרת האשראי של ${shekels(hold.amountAgorot)}: ${HOLD_STATE_LABEL[holdState(hold)]}.`}
        </p>
      )}
      <OfferStatus stage={stage} note={offerStageNote(stage, "CUSTOMER", inquiry)}>
        {canDecide(stage) && (
          <>
            <OfferButton
              needs="buy"
              action={decideInquiry}
              fields={{ ...fields, decision: "ACCEPTED" }}
              label={holdBefore ? "קבלת ההצעה ואישור באשראי" : "קבלת ההצעה"}
            />
            {holdBefore && (
              <p className="basis-full text-xs text-muted">
                בקבלת ההצעה תאשרו את ההזמנה הראשונה במסגרת אשראי של {shekels(holdBefore)} (כולל מע״מ). הכסף לא יורד,
                והמסגרת משתחררת אחרי שההזמנה סופקה. כך הספק יודע שאתם רציניים, ורק אז מקבל את פרטי הקשר שלכם.
              </p>
            )}
            <OfferReasonAction
              needs="buy"
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
            needs="buy"
            action={cancelInquiry}
            fields={fields}
            label="ביטול הפנייה"
            confirm="לבטל את הפנייה"
            placeholder="למה? (לא חובה)"
          />
        )}
      </OfferStatus>

      {ended && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">הפנייה הסתיימה. אפשר לשלוח לספק פנייה חדשה עם המחירים של היום.</p>
          <EndedOfferActions
            id={inquiry.id}
            kind="inquiry"
            supplierName={inquiry.supplier.companyName}
            newHref={newInquiryHref({ kind: "inquiry", ...inquiry }, basketIds)}
            back="/customer/inquiries"
          />
        </div>
      )}

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
          <div className="mt-3">
            <QuoteValidity
              sentAt={inquiry.createdAt}
              audience="CUSTOMER"
              answered={Boolean(inquiry.repliedAt)}
              accepted={stage === "ACCEPTED"}
              recheckHref={recheckHref(inquiry, basketIds)}
            />
          </div>
        </Card>
      ) : (
        isQuoteSnapshot(inquiry.quote) && (
          <Card title={`ההצעה שקיבלתם מהמערכת: ${shekels(inquiry.totalAgorot)} לחודש`}>
            <div className="mb-3">
              <QuoteValidity
                sentAt={inquiry.createdAt}
                audience="CUSTOMER"
                answered={Boolean(inquiry.repliedAt)}
                accepted={stage === "ACCEPTED"}
                recheckHref={recheckHref(inquiry, basketIds)}
              />
            </div>
            <QuoteTable quote={inquiry.quote} />
          </Card>
        )
      )}

      <Card title="ההודעה ששלחתם">
        <p className="whitespace-pre-line text-sm">{inquiry.message}</p>
      </Card>

      {reportable.length > 0 && (
        <PriceViolationButton
          supplierId={inquiry.supplierId}
          supplierName={inquiry.supplier.companyName}
          products={reportable}
        />
      )}
      <SupplierBlockControl
        customerId={customer.id}
        supplierId={inquiry.supplierId}
        supplierName={inquiry.supplier.companyName}
        back={`/customer/inquiries/${inquiry.id}`}
      />
    </div>
  );
}
