import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AdminSidebar } from "./sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  const [suppliers, prices, products, reviews, reports, violations, documents] = await Promise.all([
    db.supplier.count({ where: { status: "PENDING" } }),
    Promise.all([
      db.offerPrice.count({ where: { status: "PENDING_APPROVAL" } }),
      db.supplierOffer.count({ where: { pendingBrand: { not: null } } }),
    ]).then(([a, b]) => a + b),
    db.product.count({ where: { pendingReview: true } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.abuseReport.count({ where: { status: "OPEN" } }),
    db.priceViolationReport.count({ where: { status: "OPEN" } }),
    db.supplierDocument.count({ where: { status: "PENDING" } }),
  ]);
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="rounded-lg border border-border bg-surface p-2 md:sticky md:top-4 md:w-56 md:shrink-0">
        <AdminSidebar pending={{ suppliers, prices, products, reviews, reports, violations, documents }} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}
