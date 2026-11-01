import { NotificationList } from "@/components/notifications/notification-list";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";

export default async function CustomerNotifications() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const items = await db.notification.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // הכניסה לעמוד מסמנת הכל כנקרא; ההדגשה נשארת לביקור הזה
  await db.notification.updateMany({ where: { customerId: customer.id, read: false }, data: { read: true } });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">התראות</h1>
        <p className="text-sm text-muted">
          מחיר שעלה או ירד אצל הספקים שלכם, ספק אחר שמוכר זול ממה שאתם משלמים, ותשובות מספקים.
        </p>
      </div>
      <NotificationList
        items={items}
        empty="עדיין אין התראות. כשספק ישנה מחיר של מוצר שאתם קונים, או יענה לכם, תראו את זה כאן."
      />
    </div>
  );
}
