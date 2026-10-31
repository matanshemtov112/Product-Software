import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { shekels } from "@/lib/format";
import { packLabel } from "@/lib/pack";
import {
  listOffers,
  offerImageUrl,
  type OfferWithPrices,
  pricesByTier,
  supplierForUser,
  UNIT_LABEL,
} from "@/lib/supplier/catalog";
import { DeleteOfferButton } from "./delete-button";
import { OfferImage } from "./offer-image";

type View = "list" | "grid";

function Badges({ offer, pending }: { offer: OfferWithPrices; pending: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {!offer.available && <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">לא זמין</span>}
      {pending && <span className="rounded bg-accent-soft px-2 py-0.5 text-xs">מחיר ממתין לאישור</span>}
      {offer.product.pendingReview && (
        <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">מוצר חדש בבדיקה</span>
      )}
    </div>
  );
}

function Actions({ offer }: { offer: OfferWithPrices }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href={`/supplier/products/${offer.id}/edit`} className="text-accent hover:underline">
        עריכה
      </Link>
      <DeleteOfferButton offerId={offer.id} productName={offer.product.name} />
      <Link href={`/supplier/products/${offer.id}`} className="hover:underline">
        פרטים נוספים
      </Link>
    </div>
  );
}

function basePrice(offer: OfferWithPrices, firstTierId: string | undefined) {
  const entry = firstTierId ? pricesByTier(offer).get(firstTierId) : undefined;
  const pending = [...pricesByTier(offer).values()].some((p) => p.pending !== null);
  return { live: entry?.live ?? null, pending };
}

function ViewToggle({ view, params }: { view: View; params: URLSearchParams }) {
  const link = (v: View) => {
    const next = new URLSearchParams(params);
    next.set("view", v);
    return `/supplier?${next}`;
  };
  const cls = (on: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm ${on ? "bg-accent-soft font-medium text-accent" : "hover:bg-background"}`;
  return (
    <div role="group" aria-label="תצוגה" className="flex overflow-hidden rounded-md border border-border bg-surface">
      <Link href={link("list")} aria-current={view === "list"} className={cls(view === "list")}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        רשימה
      </Link>
      <Link href={link("grid")} aria-current={view === "grid"} className={cls(view === "grid")}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
        </svg>
        קוביות
      </Link>
    </div>
  );
}

export default async function SupplierProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; view?: string }>;
}) {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const { q = "", category, view: rawView } = await searchParams;
  const view: View = rawView === "grid" ? "grid" : "list";
  const offers = await listOffers(supplier.id, { q, categoryId: category });
  const firstTier = supplier.priceTiers[0];
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const categoryName = category ? offers[0]?.product.category.name : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{supplier.companyName}</h1>
          <p className="text-sm text-muted">
            {categoryName ? `${categoryName} · ` : ""}
            {offers.length} מוצרים{firstTier ? ` · מחירים במדרגת "${firstTier.name}", ללא מע״מ` : ""}
          </p>
        </div>
        <Link
          href="/supplier/products/new"
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          + מוצר חדש
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form role="search" className="flex min-w-0 flex-1 gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="חיפוש מוצר"
            aria-label="חיפוש מוצר"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <input type="hidden" name="view" value={view} />
          <button className="rounded-md border border-border bg-surface px-4 py-2 text-sm">חיפוש</button>
        </form>
        <ViewToggle view={view} params={params} />
      </div>

      {offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          {q ? `לא נמצאו מוצרים עבור "${q}".` : "עדיין אין מוצרים ברשימה."}{" "}
          <Link href="/supplier/products/new" className="text-accent">
            הוספת מוצר
          </Link>
        </div>
      ) : view === "list" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {offers.map((offer) => {
            const price = basePrice(offer, firstTier?.id);
            return (
              <li key={offer.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <OfferImage offerId={offer.id} src={offerImageUrl(offer)} name={offer.product.name} variant="thumb" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{offer.product.name}</span>
                      <Badges offer={offer} pending={price.pending} />
                    </div>
                    <span className="text-sm text-muted">
                      {offer.supplierProductName ? `"${offer.supplierProductName}" · ` : ""}
                      {offer.product.category.name} · {packLabel({ ...offer, unit: offer.product.unit })}
                      {offer.brand ? ` · ${offer.brand}` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="whitespace-nowrap font-semibold">
                    {price.live !== null ? `${shekels(price.live, 2)} / ${UNIT_LABEL[offer.product.unit]}` : "אין מחיר"}
                  </span>
                  <Actions offer={offer} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const price = basePrice(offer, firstTier?.id);
            return (
              <li key={offer.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <OfferImage offerId={offer.id} src={offerImageUrl(offer)} name={offer.product.name} variant="card" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{offer.product.category.name}</span>
                  <span className="font-medium">{offer.product.name}</span>
                  <Badges offer={offer} pending={price.pending} />
                </div>
                <div>
                  <p className="text-xl font-bold">{price.live !== null ? shekels(price.live, 2) : "אין מחיר"}</p>
                  <p className="text-xs text-muted">
                    ל{UNIT_LABEL[offer.product.unit]} · {packLabel({ ...offer, unit: offer.product.unit })}
                  </p>
                </div>
                <div className="mt-auto border-t border-border pt-3">
                  <Actions offer={offer} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
