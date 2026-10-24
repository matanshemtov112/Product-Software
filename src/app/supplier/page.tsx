import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { PENDING: "ממתין לאישור", APPROVED: "מאושר", REJECTED: "נדחה" } as const;

export default async function SupplierHome() {
  const session = await requireRole("SUPPLIER");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    include: {
      supplier: {
        include: {
          _count: { select: { offers: true, negotiations: true } },
          priceTiers: { orderBy: { minMonthlyAgorot: "asc" } },
          deliveryZones: { include: { region: true } },
        },
      },
    },
  });
  const supplier = user.supplier!;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{supplier.companyName}</h1>
        <p className="text-muted">
          ח.פ. {supplier.companyNumber} · {STATUS_LABEL[supplier.status]}
        </p>
      </div>
      {supplier.status === "PENDING" && (
        <Card>
          <p className="text-sm">החשבון ממתין לאישור צוות הפלטפורמה. אפשר כבר להכין קטלוג ומחירון.</p>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="קטלוג">
          <p className="text-3xl font-bold">{supplier._count.offers}</p>
          <p className="text-sm text-muted">מוצרים במחירון</p>
        </Card>
        <Card title="מדרגות מחיר">
          {supplier.priceTiers.length === 0 ? (
            <p className="text-sm text-muted">עדיין לא הוגדרו מדרגות.</p>
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
        <Card title="בקשות מו״מ">
          <p className="text-3xl font-bold">{supplier._count.negotiations}</p>
          <p className="text-sm text-muted">בקשות מלקוחות</p>
        </Card>
      </div>
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
  );
}
