import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("ADMIN");
  const [customers, approved, pending, products, pendingPrices, pendingSuppliers] = await Promise.all([
    db.customer.count(),
    db.supplier.count({ where: { status: "APPROVED" } }),
    db.supplier.count({ where: { status: "PENDING" } }),
    db.product.count(),
    db.offerPrice.count({ where: { status: "PENDING_APPROVAL" } }),
    db.supplier.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10 }),
  ]);
  const stats = [
    { label: "לקוחות", value: customers },
    { label: "ספקים מאושרים", value: approved },
    { label: "ספקים ממתינים", value: pending },
    { label: "מוצרים בקטלוג", value: products },
    { label: "שינויי מחיר לאישור", value: pendingPrices },
  ];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">ניהול הפלטפורמה</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Card>
        ))}
      </div>
      <Card title="ספקים שממתינים לאישור">
        {pendingSuppliers.length === 0 ? (
          <p className="text-sm text-muted">אין ספקים בהמתנה.</p>
        ) : (
          <ul className="text-sm">
            {pendingSuppliers.map((s) => (
              <li key={s.id}>
                {s.companyName} · ח.פ. {s.companyNumber}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
