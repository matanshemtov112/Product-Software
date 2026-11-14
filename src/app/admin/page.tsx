import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { purgeOldInvoices } from "@/lib/invoices/retention";
import { offeredPrice } from "@/lib/matches";

const DAY = 86_400_000;

function Stat({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <div className={`h-full rounded-lg border border-border bg-surface p-4 ${href ? "hover:border-accent" : ""}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminHome() {
  await requireRole("ADMIN");
  // מדיניות השמירה רצה כשאדמין נכנס; אין צורך בתזמון נפרד בפיילוט
  await purgeOldInvoices();
  const since = new Date(Date.now() - 30 * DAY);
  const [
    customers,
    newCustomers,
    suppliers,
    pendingSuppliers,
    products,
    pendingProducts,
    pendingPrices,
    pendingReviews,
    openReports,
    baskets,
    checks,
    invoices,
    inquiries,
    matches,
    accepted,
    activeCustomers,
    openViolations,
    flaggedSuppliers,
    pendingDocuments,
  ] = await Promise.all([
    db.customer.count(),
    db.customer.count({ where: { createdAt: { gte: since } } }),
    db.supplier.count({ where: { status: "APPROVED" } }),
    db.supplier.count({ where: { status: "PENDING" } }),
    db.product.count(),
    db.product.count({ where: { pendingReview: true } }),
    db.offerPrice.count({ where: { status: "PENDING_APPROVAL" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.abuseReport.count({ where: { status: "OPEN" } }),
    db.basket.count({ where: { createdAt: { gte: since } } }),
    db.optimizationRun.count({ where: { createdAt: { gte: since } } }),
    db.invoice.count({ where: { createdAt: { gte: since } } }),
    db.negotiationRequest.count({ where: { createdAt: { gte: since } } }),
    db.matchRequest.count({ where: { createdAt: { gte: since } } }),
    db.matchRequestLine.findMany({ where: { decision: "ACCEPTED", decidedAt: { gte: since } } }),
    db.basket.groupBy({ by: ["customerId"], where: { runs: { some: { createdAt: { gte: since } } } } }),
    db.priceViolationReport.count({ where: { status: "OPEN" } }),
    db.supplier.count({ where: { violationStage: { gt: 0 } } }),
    db.supplierDocument.count({ where: { status: "PENDING" } }),
  ]);
  const saved = accepted.reduce((sum, l) => {
    const price = offeredPrice(l);
    return price === null ? sum : sum + Math.max(0, Math.round((l.currentPriceAgorot - price) * l.monthlyQuantity));
  }, 0);
  const waiting =
    pendingSuppliers +
    pendingPrices +
    pendingProducts +
    pendingReviews +
    openReports +
    openViolations +
    pendingDocuments;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול הפלטפורמה</h1>
        <p className="text-sm text-muted">
          {waiting > 0 ? `${waiting} דברים ממתינים לטיפול שלכם.` : "אין שום דבר שממתין לטיפול."}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">ממתין לטיפול</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="ספקים לאישור" value={pendingSuppliers} href="/admin/suppliers" />
          <Stat label="מסמכי אימות לבדיקה" value={pendingDocuments} href="/admin/verification" />
          <Stat label="שינויי מחיר לאישור" value={pendingPrices} note="שינוי של יותר מ-30%" href="/admin/prices" />
          <Stat
            label="מוצרים חדשים לבדיקה"
            value={pendingProducts}
            note="לא מוצגים ללקוחות עד הבדיקה"
            href="/admin/products?pending=1"
          />
          <Stat label="ביקורות לאישור" value={pendingReviews} href="/admin/reviews" />
          <Stat
            label="דיווחי הפרת מחיר חדשים"
            value={openViolations}
            note={flaggedSuppliers ? `${flaggedSuppliers} ספקים עברו 7 דיווחים` : undefined}
            href="/admin/violations"
          />
          <Stat label="דיווחים פתוחים" value={openReports} href="/admin/reports" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">הפלטפורמה</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="לקוחות" value={customers} note={`${newCustomers} חדשים ב-30 הימים האחרונים`} />
          <Stat label="ספקים מאושרים" value={suppliers} />
          <Stat label="מוצרים בקטלוג" value={products} />
          <Stat label="לקוחות פעילים" value={activeCustomers.length} note="הריצו בדיקה ב-30 הימים האחרונים" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">פעילות ב-30 הימים האחרונים</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="סלים חדשים" value={baskets} />
          <Stat label="בדיקות מחיר" value={checks} />
          <Stat label="חשבוניות שהועלו" value={invoices} />
          <Stat label="פניות לספקים" value={inquiries} />
          <Stat label="בקשות השוואה" value={matches} />
          <Stat label="חיסכון שלקוחות אישרו" value={shekels(saved)} note="בחודש, ממחירים שספקים השוו" />
        </div>
      </section>
    </div>
  );
}
