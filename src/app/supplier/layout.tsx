import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current";
import { categoryCounts, supplierForUser } from "@/lib/supplier/catalog";
import { SupplierSidebar } from "./sidebar";

export const dynamic = "force-dynamic";

const STATUS_NOTE = {
  PENDING: "החשבון ממתין לאישור צוות הפלטפורמה. אפשר כבר לבנות את רשימת המוצרים; היא תופיע בהשוואות אחרי האישור.",
  REJECTED: "החשבון לא אושר. לפרטים נא לפנות לצוות הפלטפורמה.",
  APPROVED: null,
} as const;

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const categories = await categoryCounts(supplier.id);
  const total = categories.reduce((s, c) => s + c.count, 0);
  const note = STATUS_NOTE[supplier.status];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="rounded-lg border border-border bg-surface p-2 md:sticky md:top-4 md:w-56 md:shrink-0">
        <Suspense>
          <SupplierSidebar categories={categories} total={total} />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {note && <p className="rounded-md border border-border bg-accent-soft px-4 py-3 text-sm">{note}</p>}
        {children}
      </div>
    </div>
  );
}
