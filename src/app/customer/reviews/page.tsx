import { Card } from "@/components/form";
import { Stars } from "@/components/stars";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";

const DIMENSIONS = [
  ["payment", "עמידה בתנאי תשלום"],
  ["communication", "תקשורת והתנהלות"],
] as const;

export default async function CustomerReviews() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const reviews = await db.customerReview.findMany({
    where: { customerId: customer.id },
    include: { supplier: { select: { companyName: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const avg = (pick: (r: (typeof reviews)[number]) => number) =>
    reviews.length ? reviews.reduce((s, r) => s + pick(r), 0) / reviews.length : 0;
  const overall = avg((r) => r.overall);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ביקורות עליי</h1>
        <p className="text-sm text-muted">
          מה ספקים שעבדו איתכם כתבו עליכם. ספק יכול לכתוב ביקורת רק אחרי שפניתם אליו, וביקורת טובה עוזרת לקבל תנאים טובים יותר.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          עדיין אין ביקורות. אחרי שתפנו לספק מתוך ההשוואה, הוא יוכל לכתוב עליכם ביקורת.
        </div>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-4">
                <p className="text-5xl font-bold">{overall.toFixed(1)}</p>
                <div className="flex flex-col gap-1">
                  <Stars value={overall} size={22} />
                  <p className="text-sm text-muted">{reviews.length} ביקורות מספקים</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {DIMENSIONS.map(([key, label]) => {
                  const value = avg((r) => r[key]);
                  return (
                    <li key={key} className="flex items-center justify-between gap-4">
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        <Stars value={value} size={14} />
                        <span className="w-7 text-muted">{value.toFixed(1)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.supplier.companyName}</p>
                  <div className="flex flex-col items-end gap-0.5">
                    <Stars value={r.overall} />
                    <span className="text-xs text-muted">{r.updatedAt.toLocaleDateString("he-IL")}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">
                  תשלום {r.payment}/5 · תקשורת {r.communication}/5
                </p>
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
