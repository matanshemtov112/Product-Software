import Link from "next/link";
import { GuaranteeBadge } from "@/components/guarantee";
import { requireRole } from "@/lib/auth/current";
import { listGuarantees } from "@/lib/guarantee-view";
import { dealNumber, GUARANTEE_DAYS } from "@/lib/guarantees";
import { supplierForUser } from "@/lib/supplier/catalog";

export default async function SupplierAgreements() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const rows = await listGuarantees({ supplierId: supplier.id });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">עסקאות</h1>
        <p className="text-sm text-muted">
          כשלקוח מקבל הצעה שלכם, המחירים בה מובטחים לו {GUARANTEE_DAYS} יום, בכל ההזמנות. שינוי מחיר במחירון לא משנה
          אותם. אם צריך לשנות מחיר מובטח, שולחים בקשה מעמוד העסקה, והיא חלה רק אם הלקוח מאשר.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          עוד אין עסקאות. כשלקוח יקבל הצעה שלכם, היא תופיע כאן.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/supplier/agreements/${g.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block font-medium">
                    {g.customer.businessName} · {g.customer.city}
                  </span>
                  <span className="block text-xs text-muted">
                    עסקה {dealNumber(g.number)} · {g._count.lines} מוצרים
                    {g._count.changes > 0 ? ` · ${g._count.changes} בקשות שינוי ממתינות ללקוח` : ""}
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
