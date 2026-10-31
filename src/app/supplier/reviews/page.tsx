import { Card } from "@/components/form";
import { Stars } from "@/components/stars";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { MIN_REVIEWS_FOR_RATING } from "@/lib/engine/load";
import { supplierForUser } from "@/lib/supplier/catalog";

const DIMENSIONS = [
  ["quality", "איכות"],
  ["price", "מחיר"],
  ["reliability", "עמידה בזמנים"],
  ["service", "שירות"],
  ["responsiveness", "זמינות ותגובה"],
  ["accuracy", "דיוק בהזמנה"],
  ["resolution", "טיפול בבעיות"],
] as const;

export default async function SupplierReviews() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const [reviews, pending] = await Promise.all([
    db.review.findMany({
      where: { supplierId: supplier.id, status: "PUBLISHED" },
      include: { customer: { select: { businessName: true, businessType: true, city: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.review.count({ where: { supplierId: supplier.id, status: "PENDING" } }),
  ]);

  const avg = (pick: (r: (typeof reviews)[number]) => number) =>
    reviews.length ? reviews.reduce((s, r) => s + pick(r), 0) / reviews.length : 0;
  const overall = avg((r) => r.overall);
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.overall === n).length }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">דירוגים</h1>
        <p className="text-sm text-muted">
          מה לקוחות כתבו עליכם. ביקורות מתפרסמות אחרי בדיקה של צוות הפלטפורמה
          {pending > 0 ? `, ו-${pending} ממתינות כרגע לבדיקה` : ""}.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          עדיין אין דירוגים שפורסמו.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="flex items-center gap-4">
                <p className="text-5xl font-bold">{overall.toFixed(1)}</p>
                <div className="flex flex-col gap-1">
                  <Stars value={overall} size={22} />
                  <p className="text-sm text-muted">{reviews.length} דירוגים</p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                {distribution.map(({ n, count }) => (
                  <li key={n} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-muted">{n} ★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                      <span
                        className="block h-full rounded-full bg-[#f2a50c]"
                        style={{ width: `${(count / reviews.length) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-start text-muted">{count}</span>
                  </li>
                ))}
              </ul>
              {reviews.length < MIN_REVIEWS_FOR_RATING && (
                <p className="mt-3 text-xs text-muted">
                  הדירוג ייכנס לחישוב ההמלצות מ-{MIN_REVIEWS_FOR_RATING} דירוגים. עד אז נעשה שימוש בדירוג ניטרלי.
                </p>
              )}
            </Card>
            <Card title="לפי נושא">
              <ul className="flex flex-col gap-2 text-sm">
                {DIMENSIONS.map(([key, label]) => {
                  const value = avg((r) => r[key]);
                  return (
                    <li key={key} className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        <Stars value={value} size={14} />
                        <span className="w-7 text-muted">{value.toFixed(1)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.customer.businessName}</p>
                    <p className="text-xs text-muted">
                      {r.customer.businessType} · {r.customer.city}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Stars value={r.overall} />
                    <span className="text-xs text-muted">{r.createdAt.toLocaleDateString("he-IL")}</span>
                  </div>
                </div>
                {r.text ? (
                  <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">ללא הערה</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
