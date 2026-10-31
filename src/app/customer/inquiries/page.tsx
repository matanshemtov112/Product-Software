import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL } from "@/lib/inquiries";
import Link from "next/link";
import { MATCH_STATUS_LABEL, matchSummary } from "@/lib/matches";

export default async function CustomerInquiries({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const inquiries = await db.negotiationRequest.findMany({
    where: { customerId: customer.id },
    include: { supplier: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const matches = await db.matchRequest.findMany({
    where: { customerId: customer.id },
    include: { supplier: { select: { companyName: true } }, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">פניות לספקים</h1>
        <p className="text-sm text-muted">פניות ששלחתם לספקים מתוך ההשוואה, והתשובות שלהם.</p>
      </div>
      {sent && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          הפנייה נשלחה לספק. התשובה תופיע כאן.
        </p>
      )}
      {matches.length > 0 && (
        <Card title="בקשות השוואה מהספקים שלכם">
          <ul className="divide-y divide-border">
            {matches.map((m) => {
              const sum = matchSummary(m.lines);
              return (
                <li key={m.id}>
                  <Link
                    href={`/customer/matches/${m.id}`}
                    className="flex flex-col gap-1 py-3 text-sm hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {sum.awaitingDecision > 0 && (
                        <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                      )}
                      <span className="font-medium">{m.supplier.companyName}</span>
                      <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">
                        {MATCH_STATUS_LABEL[m.status]}
                      </span>
                    </span>
                    <span className="text-muted">
                      {m.lines.length} מוצרים · {m.createdAt.toLocaleDateString("he-IL")}
                      {m.status === "SENT" || m.status === "READ"
                        ? ` · ביקשתם חיסכון של ${shekels(sum.requestedAgorot)} בחודש`
                        : ` · הספק הציע חיסכון של ${shekels(sum.offeredAgorot)} בחודש`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card title={matches.length > 0 ? "פניות לספקים חדשים" : undefined}>
        {inquiries.length === 0 ? (
          <p className="text-sm text-muted">עדיין לא שלחתם פניות. אפשר לפנות לספק מתוך עמוד ההשוואה של סל.</p>
        ) : (
          <ul className="divide-y divide-border">
            {inquiries.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{i.supplier.companyName}</span>
                  <span className="text-muted">
                    {i.createdAt.toLocaleDateString("he-IL")} · {INQUIRY_STATUS_LABEL[i.status]}
                  </span>
                </div>
                <p className="text-muted">
                  הצעה של {shekels(i.totalAgorot)} לחודש{i.gapAgorot ? `, פער של ${shekels(i.gapAgorot)}` : ""}
                </p>
                {i.reply && (
                  <p className="rounded-md bg-background px-3 py-2">
                    <span className="text-muted">תשובת הספק: </span>
                    {i.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
