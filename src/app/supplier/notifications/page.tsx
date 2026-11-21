import { NotificationList } from "@/components/notifications/notification-list";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import Link from "next/link";
import { visibleFilter } from "@/lib/notify/prefs";
import { supplierForUser } from "@/lib/supplier/catalog";

export default async function SupplierNotifications() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const items = await db.notification.findMany({
    where: { supplierId: supplier.id, ...(await visibleFilter(session.userId)) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  await db.notification.updateMany({ where: { supplierId: supplier.id, read: false }, data: { read: true } });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">התראות</h1>
          <Link href="/supplier/notifications/settings" className="text-sm text-accent hover:underline">
            הגדרות התראות
          </Link>
        </div>
        <p className="text-sm text-muted">פניות חדשות מלקוחות, בקשות להשוות מחיר והחלטות של לקוחות על ההצעות שלכם.</p>
      </div>
      <NotificationList items={items} empty="עדיין אין התראות. כשלקוח יפנה אליכם, תראו את זה כאן." />
    </div>
  );
}
