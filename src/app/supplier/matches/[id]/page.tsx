import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { isCustomerProfile, profileRows } from "@/lib/inquiries";
import { MATCH_DECISION_LABEL, MATCH_STATUS_LABEL, matchSummary } from "@/lib/matches";
import { supplierForUser } from "@/lib/supplier/catalog";
import { RespondForm } from "./respond-form";

const unitLabel = (u: string) => UNIT_LABEL[u as keyof typeof UNIT_LABEL] ?? u;

export default async function SupplierMatch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ answered?: string }>;
}) {
  const { id } = await params;
  const { answered } = await searchParams;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const request = await db.matchRequest.findFirst({
    where: { id, supplierId: supplier.id },
    include: { customer: { select: { businessName: true, businessType: true, city: true } }, lines: true },
  });
  if (!request) notFound();
  if (request.status === "SENT") {
    await db.matchRequest.update({ where: { id }, data: { status: "READ" } });
    request.status = "READ";
  }
  const summary = matchSummary(request.lines);
  const lines = [...request.lines].sort((a, b) => a.productName.localeCompare(b.productName, "he"));
  const decided = lines.filter((l) => l.decision !== "PENDING");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/supplier/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">{request.customer.businessName} מבקשים שתשוו מחירים</h1>
        <p className="text-sm text-muted">
          {request.customer.businessType} · {request.customer.city} · {request.createdAt.toLocaleDateString("he-IL")} ·{" "}
          {MATCH_STATUS_LABEL[request.status]}
        </p>
      </div>

      {answered && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          התשובה נשלחה ללקוח. כשהלקוח יאשר או ידחה, תראו את זה כאן.
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          הלקוח כבר קונה אצלכם ורוצה להמשיך. הוא מצא במערכת מחירים זולים יותר ל-{lines.length} מוצרים, שחוסכים לו עד{" "}
          <strong>{shekels(summary.requestedAgorot)}</strong> בחודש. שם הספק שמציע אותם לא נחשף.
        </p>
        <p className="mt-1 text-muted">
          אפשר להשוות, להציע מחיר אחר או לסרב לכל מוצר. המחיר שתציעו חל על הלקוח הזה בלבד ולא משנה את המחירון שלכם.
          המחירים ללא מע״מ.
        </p>
      </div>

      {request.message && (
        <Card title="ההודעה מהלקוח">
          <p className="whitespace-pre-line text-sm">{request.message}</p>
        </Card>
      )}

      <Card title="התשובה שלכם">
        <RespondForm
          requestId={request.id}
          note={request.supplierNote}
          answered={request.status === "ANSWERED" || request.status === "CLOSED"}
          lines={lines.map((l) => ({
            id: l.id,
            productName: l.productName,
            unitLabel: unitLabel(l.unit),
            monthlyQuantity: l.monthlyQuantity,
            currentPriceAgorot: l.currentPriceAgorot,
            targetPriceAgorot: l.targetPriceAgorot,
            response: l.response,
            counterPriceAgorot: l.counterPriceAgorot,
            locked: l.decision !== "PENDING",
          }))}
        />
      </Card>

      {decided.length > 0 && (
        <Card title="החלטות הלקוח">
          <ul className="flex flex-col gap-1 text-sm">
            {decided.map((l) => (
              <li key={l.id}>
                {l.productName}: <strong>{MATCH_DECISION_LABEL[l.decision]}</strong>
              </li>
            ))}
          </ul>
          {summary.acceptedAgorot > 0 && (
            <p className="mt-2 text-sm text-muted">
              הלקוח אישר מחירים שחוסכים לו {shekels(summary.acceptedAgorot)} בחודש, וממשיך להזמין מכם.
            </p>
          )}
        </Card>
      )}

      {isCustomerProfile(request.customerProfile) && (
        <Card title="פרטי הלקוח">
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {profileRows(request.customerProfile).map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-32 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
