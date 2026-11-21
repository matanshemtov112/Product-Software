import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/form";
import { ConfirmForm } from "@/components/confirm-form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { dealInput, dealLabel } from "@/lib/deal-label";
import { UNIT_LABEL } from "@/lib/format";
import { packLabel } from "@/lib/pack";
import { supplierForUser } from "@/lib/supplier/catalog";
import { customersWithProducts } from "@/lib/supplier/deal-reach";
import { endDeal } from "./actions";

export const dynamic = "force-dynamic";

const customers = (n: number) => (n === 1 ? "לקוח אחד" : `${n} לקוחות`);

const editUrl = (offerId: string) => `/supplier/products/${offerId}/edit?deal=1&back=deals#deal`;

/** כל מבצעי הכמות של הספק במקום אחד: מה פעיל, כמה לקוחות שמים את המוצר בסל, והוספת מבצע חדש */
export default async function SupplierDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; saved?: string; ended?: string }>;
}) {
  const { start, saved, ended } = await searchParams;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  // בחירת מוצר למבצע חדש: ממשיכים לטופס המבצע של אותו מוצר
  if (start) {
    const offer = await db.supplierOffer.findFirst({
      where: { id: start, supplierId: supplier.id, archivedAt: null },
      select: { id: true },
    });
    if (offer) redirect(editUrl(offer.id));
  }

  const now = new Date();
  const rawOffers = await db.supplierOffer.findMany({
    where: { supplierId: supplier.id, archivedAt: null },
    select: {
      id: true,
      packType: true,
      packSize: true,
      packSizeMax: true,
      product: { select: { id: true, name: true, unit: true } },
      quantityDeal: true,
    },
    orderBy: { product: { name: "asc" } },
  });
  const offers = rawOffers.map((o) => ({ ...o, packLabel: packLabel({ ...o, unit: o.product.unit }) }));
  const withDeal = offers.filter((o) => o.quantityDeal);
  const active = withDeal.filter((o) => !o.quantityDeal!.validTo || o.quantityDeal!.validTo > now);
  const expired = withDeal.filter((o) => o.quantityDeal!.validTo && o.quantityDeal!.validTo <= now);
  const reach = await customersWithProducts(
    supplier.id,
    offers.map((o) => o.product.id),
  );
  const choices = offers
    .filter((o) => !o.quantityDeal || expired.includes(o))
    .map((o) => ({ ...o, reach: reach.get(o.product.id) ?? 0 }))
    .sort((a, b) => b.reach - a.reach || a.product.name.localeCompare(b.product.name, "he"));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מבצעים</h1>
        <p className="text-sm text-muted">
          מבצע כמות: מחיר מיוחד למי שמזמין כמות גדולה בהזמנה אחת, למשל ״סוכר: מ-10 מארזים, ₪3 ליחידה במקום ₪3.80״.
          לקוחות שהכמות שלהם מספיקה מקבלים את המחיר בהשוואה, וכל הלקוחות באזורי המשלוח שלכם רואים את המבצע בדף המבצעים.
        </p>
      </div>

      {saved && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-accent">
          המבצע נשמר.
        </p>
      )}
      {ended && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-accent">
          המבצע הסתיים. המחיר הרגיל נשאר כמו שהיה.
        </p>
      )}

      <Card title="מבצע חדש">
        <form
          method="get"
          action="/supplier/deals"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          data-needs="prices"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">על איזה מוצר?</span>
            <select
              name="start"
              required
              defaultValue=""
              className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2"
            >
              <option value="" disabled>
                בחרו מוצר…
              </option>
              {choices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.product.name}
                  {o.packLabel ? ` (${o.packLabel})` : ""}
                  {o.reach > 0 ? ` · ${customers(o.reach)} בסל` : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">המשך להגדרת המבצע</button>
        </form>
        <p className="mt-2 text-xs text-muted">
          המוצרים שהכי הרבה לקוחות באזור שלכם שמים בסל מופיעים ראשונים. לא מוצגים שמות של לקוחות.
        </p>
      </Card>

      <Card title={`מבצעים פעילים (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-muted">אין כרגע מבצעים פעילים.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {active.map((o) => {
              const unit = UNIT_LABEL[o.product.unit];
              const count = reach.get(o.product.id) ?? 0;
              return (
                <li
                  key={o.id}
                  id={`deal-${o.id}`}
                  className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${saved === o.id ? "bg-accent-soft/40" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {o.product.name}
                      {o.packLabel && <span className="text-sm font-normal text-muted"> · {o.packLabel}</span>}
                    </p>
                    <p className="text-sm">{dealLabel(dealInput(o.quantityDeal!), unit)}</p>
                    <p className="text-xs text-muted">
                      {count > 0
                        ? `${customers(count)} באזורי המשלוח שלכם עם המוצר בסל`
                        : "עוד אין לקוחות באזור שלכם עם המוצר בסל"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4" data-needs="prices">
                    <Link href={editUrl(o.id)} className="text-sm text-accent hover:underline">
                      עריכה
                    </Link>
                    <ConfirmForm
                      needs="prices"
                      action={endDeal}
                      fields={{ offerId: o.id }}
                      confirm={`לסיים את המבצע על ${o.product.name}? הלקוחות יראו שוב את המחיר הרגיל.`}
                    >
                      סיום המבצע
                    </ConfirmForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {expired.length > 0 && (
        <Card title="מבצעים שהסתיימו">
          <ul className="flex flex-col divide-y divide-border text-sm">
            {expired.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {o.product.name}{" "}
                  <span className="text-muted">
                    · {dealLabel(dealInput(o.quantityDeal!), UNIT_LABEL[o.product.unit])}
                  </span>
                </span>
                <Link href={editUrl(o.id)} className="text-accent hover:underline" data-needs="prices">
                  לחדש
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
