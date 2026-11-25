import { SupplierBlockControl } from "@/components/supplier-block-control";
import { EndedOfferActions } from "@/components/ended-offer-actions";
import { QuoteValidity } from "@/components/quote-validity";
import { newInquiryHref } from "@/lib/customer/offer-links";
import { paymentTermsLabel } from "@/lib/terms";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { MATCH_DECISION_LABEL, MATCH_RESPONSE_LABEL, matchSummary, offeredPrice } from "@/lib/matches";
import { notify } from "@/lib/notifications";
import { canCancel, canDecide, matchStage, offerStageNote, ENDED_STAGES } from "@/lib/offer-status";
import { OfferReasonAction, OfferStatus } from "@/components/offer-actions";
import { cancelMatch, rejectMatch } from "../../offers/actions";
import { decideMatchLine } from "../actions";
import { GuaranteeBanner } from "@/components/guarantee-banner";

const unitLabel = (u: string) => UNIT_LABEL[u as keyof typeof UNIT_LABEL] ?? u;

const RESPONSE_STYLE = {
  PENDING: "bg-background text-muted",
  MATCHED: "bg-good-soft text-good",
  COUNTER: "bg-[#fff4c2] text-[#6b5500]",
  DECLINED: "bg-background text-danger",
} as const;

export default async function CustomerMatch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const request = await db.matchRequest.findFirst({
    where: { id, customerId: customer.id, customerDeletedAt: null },
    include: { supplier: { select: { companyName: true } }, lines: { orderBy: { productName: "asc" } } },
  });
  if (!request) notFound();
  // פתיחת תשובה של הספק מסמנת אותה כ"נצפתה", והספק מקבל על זה התראה
  if (matchStage(request) === "SENT") {
    request.offerSeenAt = new Date();
    await db.matchRequest.update({ where: { id }, data: { offerSeenAt: request.offerSeenAt } });
    await notify([
      {
        supplierId: request.supplierId,
        kind: "OFFER_VIEWED",
        title: `${customer.businessName} צפו בתשובה שלכם לבקשת ההשוואה`,
        href: `/supplier/matches/${id}`,
        dedupeKey: `offer-viewed:match:${id}:${request.answeredAt?.getTime()}`,
      },
    ]);
  }
  const stage = matchStage(request);
  const open = canDecide(stage);
  const summary = matchSummary(request.lines);
  const answered = Boolean(request.answeredAt);
  const valid = stage !== "EXPIRED";
  const anyAccepted = request.lines.some((l) => l.decision === "ACCEPTED");
  const validText = request.validUntil?.toLocaleDateString("he-IL");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">בקשת השוואה מ{request.supplier.companyName}</h1>
        <p className="text-sm text-muted">נשלחה {request.createdAt.toLocaleDateString("he-IL")} · המחירים ללא מע״מ</p>
      </div>
      <GuaranteeBanner side="CUSTOMER" matchRequestId={request.id} />

      <OfferStatus stage={stage} note={offerStageNote(stage, "CUSTOMER", request)}>
        {open && summary.awaitingDecision > 0 && (
          <OfferReasonAction
            needs="buy"
            action={rejectMatch}
            fields={{ id: request.id }}
            label={anyAccepted ? "דחיית שאר המחירים" : "דחיית כל ההצעה"}
            confirm="לדחות"
            placeholder="למה? למשל: המחירים עדיין גבוהים (לא חובה)"
          />
        )}
        {canCancel(stage, "CUSTOMER") && !anyAccepted && (
          <OfferReasonAction
            needs="buy"
            action={cancelMatch}
            fields={{ id: request.id }}
            label="ביטול הבקשה"
            confirm="לבטל את הבקשה"
            placeholder="למה? (לא חובה)"
          />
        )}
      </OfferStatus>

      {ENDED_STAGES.includes(stage) && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">הבקשה הסתיימה. אפשר לשלוח לספק בקשה חדשה עם המחירים של היום.</p>
          <EndedOfferActions
            id={request.id}
            kind="match"
            supplierName={request.supplier.companyName}
            newHref={newInquiryHref({ kind: "match", supplierName: request.supplier.companyName }, new Set())}
            back="/customer/inquiries"
          />
        </div>
      )}

      {sent && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          הבקשה נשלחה ל{request.supplier.companyName}. כשהספק יענה, התשובה תופיע כאן ובפניות לספקים.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">ביקשתם</p>
          <p className="text-2xl font-bold">{shekels(summary.requestedAgorot)}</p>
          <p className="text-xs text-muted">חיסכון בחודש, אם הספק משווה הכל</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">הספק הציע</p>
          <p className="text-2xl font-bold">{answered ? shekels(summary.offeredAgorot) : "—"}</p>
          <p className="text-xs text-muted">
            {answered
              ? `${summary.matched} השוואות · ${summary.countered} הצעות נגדיות · ${summary.declined} סירובים`
              : "ממתינים לתשובה"}
          </p>
        </div>
        <div className="rounded-lg bg-accent-soft p-4">
          <p className="text-sm">אישרתם</p>
          <p className="text-2xl font-bold text-good">{shekels(summary.acceptedAgorot)}</p>
          <p className="text-xs text-muted">חיסכון בחודש ({shekels(summary.acceptedAgorot * 12)} בשנה)</p>
        </div>
      </div>

      {(request.supplierNote || request.paymentTermsDays !== null) && (
        <Card title="הודעה מהספק">
          {request.supplierNote && <p className="whitespace-pre-line text-sm">{request.supplierNote}</p>}
          {request.paymentTermsDays !== null && (
            <p className="mt-1 text-sm text-muted">
              תנאי תשלום שהספק הציע לכם: {paymentTermsLabel(request.paymentTermsDays)}
            </p>
          )}
        </Card>
      )}

      <Card title="המוצרים">
        <div className="mb-3">
          <QuoteValidity
            sentAt={request.createdAt}
            audience="CUSTOMER"
            answered={Boolean(request.answeredAt)}
            accepted={stage === "ACCEPTED"}
            recheckHref={`/customer/suppliers/${encodeURIComponent(request.supplier.companyName)}`}
          />
        </div>
        {validText && (
          <p className={`mb-3 text-sm ${valid ? "text-muted" : "text-danger"}`}>
            {valid
              ? `ההצעה של הספק בתוקף עד ${validText}.`
              : `ההצעה של הספק פגה ב-${validText}. אפשר לשלוח לספק בקשה חדשה.`}
          </p>
        )}
        {!request.validUntil && request.answeredAt && (
          <p className="mb-3 text-sm text-muted">הספק לא קבע תוקף להצעה.</p>
        )}
        {open && summary.awaitingDecision > 0 && (
          <p className="mb-3 text-sm">
            הספק הציע מחיר ל-{summary.awaitingDecision} מוצרים. אשרו את מה שמתאים לכם, והמחיר יתעדכן בסל שלכם כמחיר שאתם
            משלמים היום.
          </p>
        )}
        <ul className="divide-y divide-border">
          {request.lines.map((l) => {
            const price = offeredPrice(l);
            const unit = unitLabel(l.unit);
            return (
              <li key={l.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.productName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${RESPONSE_STYLE[l.response]}`}>
                      {MATCH_RESPONSE_LABEL[l.response]}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    משלמים {shekels(l.currentPriceAgorot, 2)} ·{" "}
                    {request.reveal === "CEILING" && l.shownPriceAgorot
                      ? `הספק ראה "מתחת ל-${shekels(l.shownPriceAgorot, 2)}" (מצאנו ${shekels(l.targetPriceAgorot, 2)})`
                      : `ביקשתם ${shekels(l.targetPriceAgorot, 2)}`}
                    {price !== null && (
                      <>
                        {" "}
                        · <strong className="text-foreground">הספק מציע {shekels(price, 2)}</strong>
                      </>
                    )}{" "}
                    ל{unit} · {l.monthlyQuantity} {unit} בחודש
                  </p>
                </div>
                {price !== null &&
                  (l.decision === "PENDING" && !open ? (
                    <span className="shrink-0 text-sm text-muted">{valid ? "לא נענה" : "פג תוקף"}</span>
                  ) : l.decision === "PENDING" ? (
                    <form action={decideMatchLine} data-needs="buy" className="flex shrink-0 gap-2">
                      <input type="hidden" name="lineId" value={l.id} />
                      <button
                        name="decision"
                        value="ACCEPTED"
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                      >
                        אישור המחיר
                      </button>
                      <button
                        name="decision"
                        value="REJECTED"
                        className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
                      >
                        דחייה
                      </button>
                    </form>
                  ) : (
                    <span
                      className={`shrink-0 text-sm ${l.decision === "ACCEPTED" ? "font-medium text-good" : "text-muted"}`}
                    >
                      {MATCH_DECISION_LABEL[l.decision]}
                    </span>
                  ))}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          ההזמנה עצמה ממשיכה ישירות מול הספק. מחיר שאישרתם נשמר בסל, כך שההשוואות הבאות יתחילו ממנו.
        </p>
      </Card>

      {request.message && (
        <Card title="ההודעה ששלחתם">
          <p className="whitespace-pre-line text-sm">{request.message}</p>
        </Card>
      )}
      <SupplierBlockControl
        customerId={customer.id}
        supplierId={request.supplierId}
        supplierName={request.supplier.companyName}
        back={`/customer/matches/${request.id}`}
      />
    </div>
  );
}
