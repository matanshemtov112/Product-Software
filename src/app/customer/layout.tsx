import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { CUISINES } from "@/lib/customer/templates";
import { db } from "@/lib/db";
import { CuisinePicker } from "./cuisine-picker";
import { CustomerSidebar } from "./sidebar";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);

  // הגדרה ראשונה: לפני שנבחר סוג המסעדה רואים רק את מסך הבחירה
  if (!customer.cuisine) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-muted">ברוכים הבאים, {customer.businessName}</p>
          <h1 className="text-2xl font-bold">איזו מסעדה אתם?</h1>
          <p className="text-sm text-muted">
            לפי סוג המסעדה נציע לכם רשימת מוצרים סטנדרטית, אם עוד אין לכם רשימה משלכם.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <CuisinePicker cuisines={[...CUISINES]} initial={null} submitLabel="המשך" next="new" />
        </div>
      </div>
    );
  }

  const [saved, replies, reviewsAboutMe] = await Promise.all([
    db.basket.findMany({
      where: { customerId: customer.id, savedAt: { not: null } },
      select: { id: true, name: true, runs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { savedAt: "asc" },
    }),
    db.negotiationRequest.count({ where: { customerId: customer.id, status: { in: ["OFFERED", "CLOSED"] } } }),
    db.customerReview.count({ where: { customerId: customer.id } }),
  ]);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="rounded-lg border border-border bg-surface p-2 md:sticky md:top-4 md:w-60 md:shrink-0">
        <CustomerSidebar
          businessName={customer.businessName}
          cuisine={customer.cuisine}
          saved={saved.map((b) => ({ id: b.id, name: b.name, lastCheck: b.runs[0]?.createdAt.toISOString() ?? null }))}
          replies={replies}
          reviewsAboutMe={reviewsAboutMe}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}
