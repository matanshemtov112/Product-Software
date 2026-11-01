import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { decidePrice } from "../actions";

export default async function AdminPrices() {
  await requireRole("ADMIN");
  const pending = await db.offerPrice.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { tier: true, offer: { include: { product: true, supplier: { select: { companyName: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const now = new Date();
  const current = await Promise.all(
    pending.map((p) =>
      db.offerPrice.findFirst({
        where: { offerId: p.offerId, tierId: p.tierId, status: "LIVE", kind: "REGULAR", validFrom: { lte: now } },
        orderBy: { validFrom: "desc" },
      }),
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">אישור מחירים</h1>
        <p className="text-sm text-muted">
          שינוי מחיר של יותר מ-30% ממתין כאן לפני שהוא נכנס להשוואות, כדי לתפוס טעויות הקלדה (למשל מחיר לקרטון במקום
          לק״ג). מחיר שאושר נכנס לתוקף מיד, והלקוחות מקבלים התראה.
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">אין שינויי מחיר שממתינים.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((p, i) => {
            const before = current[i]?.unitPriceAgorot ?? null;
            const change = before ? Math.round(((p.unitPriceAgorot - before) / before) * 100) : null;
            const unit = UNIT_LABEL[p.offer.product.unit];
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.offer.product.name} · {p.offer.supplier.companyName}
                  </p>
                  <p className="text-sm text-muted">
                    מדרגה: {p.tier.name} · {before !== null ? `היום ${shekels(before, 2)} → ` : ""}
                    <strong className="text-foreground">{shekels(p.unitPriceAgorot, 2)}</strong> ל{unit}
                    {change !== null && (
                      <span className={change > 0 ? "text-danger" : "text-accent"}>
                        {" "}
                        ({change > 0 ? "עלייה" : "ירידה"} של {Math.abs(change)}%)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">נשלח {p.createdAt.toLocaleString("he-IL")}</p>
                </div>
                <form action={decidePrice} className="flex shrink-0 gap-2">
                  <input type="hidden" name="priceId" value={p.id} />
                  <button
                    name="decision"
                    value="approve"
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    אישור
                  </button>
                  <button
                    name="decision"
                    value="reject"
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm"
                  >
                    דחייה
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
