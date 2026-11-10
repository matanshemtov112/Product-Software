import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { AreaMap } from "./area-map";

export default async function DeliveryAreasPage() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const [areas, manager] = await Promise.all([
    db.deliveryArea.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "asc" },
      select: { label: true, lat: true, lng: true, radiusKm: true },
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
          בהשוואות רק אם העסק שלהם נמצא בתוך אחד האזורים. המשלוח תמיד חינם, ויש רק מינימום הזמנה.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <AreaMap initial={areas} canEdit={manager} />
      </div>
    </div>
  );
}
