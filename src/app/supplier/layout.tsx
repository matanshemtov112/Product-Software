import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { categoryCounts, supplierForUser } from "@/lib/supplier/catalog";
import { DomainPicker } from "./domain-picker";
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

  // הגדרה ראשונה: לפני שהספק בחר תחומים הוא רואה רק את מסך הבחירה, בכל עמוד באזור הספק
  if (!supplier.categoriesSetAt) {
    const all = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-muted">ברוכים הבאים, {supplier.companyName}</p>
          <h1 className="text-2xl font-bold">באילו תחומים אתם עובדים?</h1>
          <p className="text-sm text-muted">
            נציג לכם רק את סוגי המוצרים מהתחומים שתבחרו. אפשר לשנות את זה בכל זמן בפרטי הפרופיל.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <DomainPicker categories={all} initialIds={[]} initialAll={false} submitLabel="המשך לרשימת המוצרים" />
        </div>
      </div>
    );
  }

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
