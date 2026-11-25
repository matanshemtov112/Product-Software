import Link from "next/link";
import { GuaranteeBadge } from "@/components/guarantee";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { listGuarantees } from "@/lib/guarantee-view";
import { dealNumber, GUARANTEE_DAYS } from "@/lib/guarantees";

export default async function CustomerAgreements() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const rows = await listGuarantees({ customerId: customer.id });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מחירים מובטחים</h1>
        <p className="text-sm text-muted">
          כשאתם מקבלים הצעה של ספק, המחירים בה מובטחים לכם {GUARANTEE_DAYS} יום, בכל ההזמנות. הספק לא יכול לשנות אותם
          בלי האישור שלכם.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          עוד אין עסקאות. כשתקבלו הצעה של ספק מפנייה או מבקשת השוואה, היא תופיע כאן.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/customer/agreements/${g.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block font-medium">{g.supplier.companyName}</span>
                  <span className="block text-xs text-muted">
                    עסקה {dealNumber(g.number)} · {g._count.lines} מוצרים
                    {g._count.changes > 0 ? ` · ${g._count.changes} בקשות שינוי ממתינות לכם` : ""}
                    {g._count.breaches > 0 ? ` · ${g._count.breaches} חריגות בחשבוניות` : ""}
                  </span>
                </span>
                <GuaranteeBadge until={g.guaranteedUntil} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
