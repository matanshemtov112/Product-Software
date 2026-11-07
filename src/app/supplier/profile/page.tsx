import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { categoryTree } from "@/lib/categories";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { supplierForUser } from "@/lib/supplier/catalog";
import { supplierLogoUrl } from "@/lib/supplier/logo";
import { DomainPicker } from "../domain-picker";
import { ProfileForm } from "./profile-form";
import { TiersForm } from "./tiers-form";

const STATUS_LABEL = { PENDING: "ממתין לאישור", APPROVED: "מאושר", REJECTED: "נדחה" } as const;

export default async function SupplierProfile() {
  const session = await requireRole("SUPPLIER");
  const base = await supplierForUser(session.userId);
  const tree = await categoryTree();
  const supplier = await db.supplier.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      logo: { select: { updatedAt: true } },
      deliveryZones: { include: { region: true } },
      priceTiers: { orderBy: { minMonthlyAgorot: "asc" } },
    },
  });
  const manager = await isManager(session.userId);
  return (
    <div className="flex flex-col gap-4">
      {!manager && (
        <p className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          אפשר לראות את הפרטים, אבל רק מנהל יכול לשנות אותם.
        </p>
      )}
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
            description: supplier.description ?? "",
            openingHours: supplier.openingHours ?? "",
            deliveryTerms: supplier.deliveryTerms ?? "",
            logoUrl: supplierLogoUrl(supplier.id, supplier.logo),
          }}
        />
      </Card>
      <Card title="התחומים שלי">
        <p className="mb-3 text-sm text-muted">
          בהוספת מוצר יופיעו רק סוגי המוצרים מהתחומים האלה. מוצרים שכבר ברשימה נשארים גם אם מורידים תחום.
        </p>
        <DomainPicker
          tree={tree}
          initialIds={base.categories.map((c) => c.categoryId)}
          initialAll={base.allCategories}
          submitLabel="שמירת התחומים"
        />
      </Card>
      <Card title="מדרגות מחיר">
        <TiersForm
          initial={supplier.priceTiers.map((t) => ({ id: t.id, name: t.name, min: t.minMonthlyAgorot / 100 }))}
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
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
      <p className="text-xs text-muted">עריכת אזורי משלוח תתווסף בהמשך.</p>
    </div>
  );
}
