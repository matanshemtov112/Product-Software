import { NotificationList } from "@/components/notifications/notification-list";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";

export default async function SupplierNotifications() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const items = await db.notification.findMany({
    where: { supplierId: supplier.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  await db.notification.updateMany({ where: { supplierId: supplier.id, read: false }, data: { read: true } });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">התראות</h1>
        <p className="text-sm text-muted">פניות חדשות מלקוחות, בקשות להשוות מחיר והחלטות של לקוחות על ההצעות שלכם.</p>
      </div>
      <NotificationList items={items} empty="עדיין אין התראות. כשלקוח יפנה אליכם, תראו את זה כאן." />
    </div>
  );
}
