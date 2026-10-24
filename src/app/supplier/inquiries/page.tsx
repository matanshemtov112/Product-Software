import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL } from "@/lib/inquiries";
import { supplierForUser } from "@/lib/supplier/catalog";

export default async function SupplierInquiries() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const inquiries = await db.negotiationRequest.findMany({
    where: { supplierId: supplier.id },
    include: { customer: { select: { businessName: true, businessType: true, city: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">פניות מלקוחות</h1>
        <p className="text-sm text-muted">
          לקוחות שקיבלו מהמערכת הצעה שלכם ורוצים לעבוד איתכם, למרות פער מחיר מול ספק מתחרה. שם המתחרה לא מוצג.
        </p>
      </div>
      {inquiries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          עדיין אין פניות.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {inquiries.map((i) => {
            const isNew = i.status === "SENT";
            return (
              <li key={i.id}>
                <Link
                  href={`/supplier/inquiries/${i.id}`}
                  className="flex flex-col gap-1 p-4 hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {isNew && <span className="size-2 rounded-full bg-accent" aria-hidden="true" />}
                      <span className={isNew ? "font-semibold" : "font-medium"}>{i.customer.businessName}</span>
                      <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">
                        {INQUIRY_STATUS_LABEL[i.status]}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted">{i.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-col text-sm sm:items-end">
                    <span>
                      הצעה {shekels(i.totalAgorot)} · פער <strong>{i.gapAgorot ? shekels(i.gapAgorot) : "אין"}</strong>
                    </span>
                    <span className="text-xs text-muted">
                      {i.customer.businessType} · {i.customer.city} · {i.createdAt.toLocaleDateString("he-IL")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
