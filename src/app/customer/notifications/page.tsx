import { NotificationList } from "@/components/notifications/notification-list";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import Link from "next/link";
import { visibleFilter } from "@/lib/notify/prefs";

export default async function CustomerNotifications() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const items = await db.notification.findMany({
    where: { customerId: customer.id, ...(await visibleFilter(session.userId)) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // הכניסה לעמוד מסמנת הכל כנקרא; ההדגשה נשארת לביקור הזה
  await db.notification.updateMany({ where: { customerId: customer.id, read: false }, data: { read: true } });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">התראות</h1>
          <Link href="/customer/notifications/settings" className="text-sm text-accent hover:underline">
            הגדרות התראות
          </Link>
        </div>
        <p className="text-sm text-muted">
          תשובות מספקים, הזדמנויות לחיסכון ועדכוני מחירים. בהגדרות אפשר לבחור מה לקבל ואיך.
        </p>
      </div>
      <NotificationList
        items={items}
        empty="עדיין אין התראות. כשספק ישנה מחיר של מוצר שאתם קונים, או יענה לכם, תראו את זה כאן."
      />
    </div>
  );
}
