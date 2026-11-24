import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { AreaMap } from "./area-map";
import { timesPerWeekText } from "@/lib/terms";

export default async function DeliveryAreasPage() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const [areas, manager] = await Promise.all([
    db.deliveryArea.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "asc" },
      select: {
        label: true,
        lat: true,
        lng: true,
        radiusKm: true,
        deliveryDays: true,
        orderCutoff: true,
        deliveryNote: true,
      },
    }),
    isManager(session.userId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/supplier/profile" className="text-sm text-muted hover:text-foreground">
          → חזרה לפרופיל
        </Link>
        <h1 className="text-2xl font-bold">אזורי החלוקה שלכם</h1>
        <p className="text-sm text-muted">
          סמנו על המפה את כל האזורים שאתם מגיעים אליהם: כל אזור הוא עיגול, ובוחרים לו את הרדיוס. לקוחות יראו אתכם
          בהשוואות רק אם העסק שלהם נמצא בתוך אחד האזורים. המשלוח תמיד חינם, ויש רק מינימום הזמנה. לכל אזור אפשר גם לקבוע
          ימי אספקה ושעת סגירת הזמנות.
        </p>
      </div>
      {supplier.deliverySchedule === "PER_WEEK" && supplier.deliveriesPerWeek && (
        <p className="rounded-md bg-accent-soft px-4 py-2 text-sm">
          בחרתם להציג &quot;{timesPerWeekText(supplier.deliveriesPerWeek)}&quot; לכל האזורים, ולכן ימי האספקה שבוחרים
          כאן לא מוצגים ללקוחות.{" "}
          <Link href="/supplier/profile#delivery-days" className="font-medium text-accent hover:underline">
            שינוי ימי החלוקה
          </Link>
        </p>
      )}
      <div className="rounded-lg border border-border bg-surface p-5">
        <AreaMap initial={areas} canEdit={manager} />
      </div>
    </div>
  );
}
