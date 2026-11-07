import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import {
  isValid,
  MATCH_DECISION_LABEL,
  MATCH_RESPONSE_LABEL,
  MATCH_STATUS_LABEL,
  matchSummary,
  offeredPrice,
} from "@/lib/matches";
import { decideMatchLine } from "../actions";

const unitLabel = (u: string) => UNIT_LABEL[u as keyof typeof UNIT_LABEL] ?? u;

const RESPONSE_STYLE = {
  PENDING: "bg-background text-muted",
  MATCHED: "bg-accent-soft text-accent",
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
    where: { id, customerId: customer.id },
    include: { supplier: { select: { companyName: true } }, lines: { orderBy: { productName: "asc" } } },
  });
  if (!request) notFound();
  const summary = matchSummary(request.lines);
  const answered = request.status === "ANSWERED" || request.status === "CLOSED";
  const valid = isValid(request.validUntil);
  const validText = request.validUntil?.toLocaleDateString("he-IL");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">בקשת השוואה מ{request.supplier.companyName}</h1>
        <p className="text-sm text-muted">
          נשלחה {request.createdAt.toLocaleDateString("he-IL")} · {MATCH_STATUS_LABEL[request.status]} · המחירים ללא
          מע״מ
        </p>
      </div>

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
          <p className="text-2xl font-bold text-accent">{shekels(summary.acceptedAgorot)}</p>
          <p className="text-xs text-muted">חיסכון בחודש ({shekels(summary.acceptedAgorot * 12)} בשנה)</p>
        </div>
      </div>

      {request.supplierNote && (
        <Card title="הודעה מהספק">
          <p className="whitespace-pre-line text-sm">{request.supplierNote}</p>
        </Card>
      )}

      <Card title="המוצרים">
        {validText && (
          <p className={`mb-3 text-sm ${valid ? "text-muted" : "text-danger"}`}>
            {valid
              ? `ההצעה של הספק בתוקף עד ${validText}.`
              : `ההצעה של הספק פגה ב-${validText}. אפשר לשלוח לספק בקשה חדשה.`}
          </p>
        )}
        {valid && summary.awaitingDecision > 0 && (
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
                    <span className={`rounded px-2 py-0.5 text-xs ${RESPONSE_STYLE[l.response]}`}>
                      {MATCH_RESPONSE_LABEL[l.response]}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    משלמים {shekels(l.currentPriceAgorot, 2)} · ביקשתם {shekels(l.targetPriceAgorot, 2)}
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
                  (l.decision === "PENDING" && !valid ? (
                    <span className="shrink-0 text-sm text-muted">פג תוקף</span>
                  ) : l.decision === "PENDING" ? (
                    <form action={decideMatchLine} className="flex shrink-0 gap-2">
                      <input type="hidden" name="lineId" value={l.id} />
                      <button
                        name="decision"
                        value="ACCEPTED"
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
                      >
                        אישור המחיר
                      </button>
                      <button
                        name="decision"
                        value="REJECTED"
                        className="rounded-md border border-border bg-surface px-4 py-2 text-sm"
                      >
                        דחייה
                      </button>
                    </form>
                  ) : (
                    <span
                      className={`shrink-0 text-sm ${l.decision === "ACCEPTED" ? "font-medium text-accent" : "text-muted"}`}
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
    </div>
  );
}
