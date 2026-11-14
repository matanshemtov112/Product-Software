import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { packLabel } from "@/lib/pack";
import { supplierForUser } from "@/lib/supplier/catalog";
import { restoreOffer } from "../actions";

/** מוצרים שהספק הוציא מהרשימה: לא מופיעים בהשוואות, אבל ההיסטוריה שלהם נשמרת ואפשר להחזיר אותם */
export default async function OfferArchive({ searchParams }: { searchParams: Promise<{ conflict?: string }> }) {
  const { conflict } = await searchParams;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const offers = await db.supplierOffer.findMany({
    where: { supplierId: supplier.id, archivedAt: { not: null } },
    include: {
      product: { select: { name: true, unit: true } },
      replacedBy: { select: { id: true, brand: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/supplier" className="text-sm text-muted hover:text-foreground">
          → חזרה לרשימה
        </Link>
        <h1 className="text-2xl font-bold">ארכיון מוצרים</h1>
        <p className="text-sm text-muted">
          מוצרים שהוצאתם מהרשימה או שהוחלפו במוצר חלופי. הם לא מופיעים בהשוואות, אבל היסטוריית המחירים, הברקודים
          והשינויים שלהם נשמרת.
        </p>
      </div>
      {conflict && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          אי אפשר להחזיר את המוצר: אותה אריזה כבר נמצאת ברשימה שלכם. אפשר לערוך את המוצר שברשימה.
        </p>
      )}
      {offers.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">הארכיון ריק.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <Link href={`/supplier/products/${o.id}`} className="font-medium hover:underline">
                  {o.product.name}
                  {o.brand ? ` · ${o.brand}` : ""}
                </Link>
                <span className="block text-xs text-muted">
                  {packLabel({ ...o, unit: o.product.unit })} · בארכיון מ-{o.archivedAt!.toLocaleDateString("he-IL")}
                  {o.replacedBy && ` · הוחלף ב${o.replacedBy.brand ? `-${o.replacedBy.brand}` : "מוצר חלופי"}`}
                </span>
              </div>
              <form action={restoreOffer}>
                <input type="hidden" name="offerId" value={o.id} />
                <button className="text-sm text-accent hover:underline">החזרה לרשימה</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
