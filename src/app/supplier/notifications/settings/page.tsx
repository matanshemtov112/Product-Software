import { NotificationSettings } from "@/components/notifications/settings-page";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";

export default async function SupplierNotificationSettings() {
  const session = await requireRole("SUPPLIER");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { email: true } });
  return <NotificationSettings userId={session.userId} email={user.email} org="SUPPLIER" />;
}
