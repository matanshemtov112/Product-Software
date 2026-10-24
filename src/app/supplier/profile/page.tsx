import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { supplierForUser } from "@/lib/supplier/catalog";
import { DomainPicker } from "../domain-picker";
import { ProfileForm } from "./profile-form";

const STATUS_LABEL = { PENDING: "ממתין לאישור", APPROVED: "מאושר", REJECTED: "נדחה" } as const;

export default async function SupplierProfile() {
  const session = await requireRole("SUPPLIER");
  const base = await supplierForUser(session.userId);
  const categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const supplier = await db.supplier.findUniqueOrThrow({
    where: { id: base.id },
    include: { deliveryZones: { include: { region: true } }, priceTiers: { orderBy: { minMonthlyAgorot: "asc" } } },
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">פרטי פרופיל</h1>
        <p className="text-sm text-muted">
          ח.פ. {supplier.companyNumber} · {STATUS_LABEL[supplier.status]}
        </p>
      </div>
      <Card title="פרטי החברה">
        <ProfileForm
          initial={{
            companyName: supplier.companyName,
            contactPhone: supplier.contactPhone ?? "",
            contactEmail: supplier.contactEmail ?? "",
            minOrder: supplier.minOrderAgorot / 100,
            paymentTermsDays: supplier.paymentTermsDays,
          }}
        />
      </Card>
      <Card title="התחומים שלי">
        <p className="mb-3 text-sm text-muted">
          בהוספת מוצר יופיעו רק סוגי המוצרים מהתחומים האלה. מוצרים שכבר ברשימה נשארים גם אם מורידים תחום.
        </p>
        <DomainPicker
          categories={categories}
          initialIds={base.categories.map((c) => c.categoryId)}
          initialAll={base.allCategories}
          submitLabel="שמירת התחומים"
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="מדרגות מחיר">
          {supplier.priceTiers.length === 0 ? (
            <p className="text-sm text-muted">מדרגה בסיסית תיווצר עם המוצר הראשון.</p>
          ) : (
            <ul className="text-sm">
              {supplier.priceTiers.map((t) => (
                <li key={t.id}>
                  {t.name}: מ-{shekels(t.minMonthlyAgorot)} בחודש
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="אזורי משלוח">
          {supplier.deliveryZones.length === 0 ? (
            <p className="text-sm text-muted">עדיין לא הוגדרו אזורי משלוח.</p>
          ) : (
            <ul className="text-sm">
              {supplier.deliveryZones.map((z) => (
                <li key={z.id}>
                  {z.region.name}: משלוח {shekels(z.feeAgorot)}
                  {z.freeAboveAgorot !== null && `, חינם מעל ${shekels(z.freeAboveAgorot)}`}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-muted">עריכת מדרגות ואזורי משלוח תתווסף בהמשך.</p>
    </div>
  );
}
