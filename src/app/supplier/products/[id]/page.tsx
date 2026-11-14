import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { shekels } from "@/lib/format";
import { pricedPerPack, minOrderLabel, packLabel, packPriceLabel } from "@/lib/pack";
import { getOffer, offerImageUrl, pricesByTier, supplierForUser, UNIT_LABEL } from "@/lib/supplier/catalog";
import { endPromotion, removeOfferImage, restoreOffer } from "../../actions";
import { db } from "@/lib/db";
import { CHANGE_LABEL } from "@/lib/supplier/offer-changes";
import { DealBadge, PriceStatusBadge } from "@/components/price-badge";
import { dealInput } from "@/lib/deal-label";
import { lastValidDay } from "@/lib/price-status";
import { OfferImage } from "../../offer-image";
import { DeleteOfferButton } from "../../delete-button";

const STATUS_LABEL = { LIVE: "פעיל", PENDING_APPROVAL: "ממתין לאישור", REJECTED: "נדחה" } as const;
const KIND_LABEL = { REGULAR: "קבוע", PROMOTION: "מבצע" } as const;

export default async function ProductDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ held?: string }>;
}) {
  const { id } = await params;
  const { held } = await searchParams;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const offer = await getOffer(supplier.id, id);
  if (!offer) notFound();
  const unit = UNIT_LABEL[offer.product.unit];
  const pack = { ...offer, unit: offer.product.unit };
  const byTier = pricesByTier(offer);
  const date = (d: Date) => d.toLocaleDateString("he-IL");
  const imageSrc = offerImageUrl(offer);
  // יומן השינויים, והקשר למוצר החלופי (בשני הכיוונים)
  const [changes, related] = await Promise.all([
    db.offerChange.findMany({ where: { offerId: offer.id }, orderBy: { createdAt: "desc" } }),
    db.supplierOffer.findUnique({
      where: { id: offer.id },
      select: {
        replacedBy: { select: { id: true, brand: true } },
        replaces: { select: { id: true, brand: true } },
      },
    }),
  ]);
  const archived = Boolean(offer.archivedAt);

  const details = [
    ["סוג מוצר", offer.product.category.name],
    ["יחידת מכירה", unit],
    ["איך המוצר מגיע", packLabel(pack)],
    ["כמות מינימלית להזמנה", minOrderLabel(pack) ?? "אין"],
    ["השם שלכם למוצר", offer.supplierProductName ?? "לא צוין"],
    ["מותג", offer.brand ?? "לא צוין"],
    ['מק"ט', offer.supplierSku ?? "לא צוין"],
    ["ברקוד", offer.barcode ?? "לא צוין"],
    ["זמינות", offer.available ? "זמין" : "לא זמין"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/supplier" className="text-sm text-muted hover:text-foreground">
            → חזרה לרשימה
          </Link>
          <h1 className="text-2xl font-bold">{offer.product.name}</h1>
          {offer.product.pendingReview && (
            <p className="text-sm text-muted">מוצר חדש בקטלוג, ממתין לבדיקת צוות הפלטפורמה.</p>
          )}
        </div>
        {archived ? (
          <form action={restoreOffer}>
            <input type="hidden" name="offerId" value={offer.id} />
            <button className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft">
              החזרה מהארכיון
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/supplier/products/${offer.id}/edit`}
              className="rounded-md bg-accent px-4 py-2 text-sm text-white"
            >
              עריכה
            </Link>
            <Link
              href={`/supplier/products/new?addPack=${offer.id}`}
              className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft"
            >
              + אריזה נוספת
            </Link>
            <DeleteOfferButton offerId={offer.id} productName={offer.product.name} />
          </div>
        )}
      </div>

      {archived && (
        <p role="status" className="rounded-md bg-background px-4 py-3 text-sm">
          המוצר בארכיון מ-{date(offer.archivedAt!)} ולא מופיע בהשוואות. ההיסטוריה שלו נשמרת כאן.
          {related?.replacedBy && (
            <>
              {" "}
              הוא הוחלף במוצר חלופי:{" "}
              <Link href={`/supplier/products/${related.replacedBy.id}`} className="text-accent hover:underline">
                {offer.product.name}
                {related.replacedBy.brand ? ` של ${related.replacedBy.brand}` : ""}
              </Link>
              .
            </>
          )}
        </p>
      )}
      {!archived && related && related.replaces.length > 0 && (
        <p className="rounded-md bg-background px-4 py-3 text-sm">
          מוצר חלופי. הוא החליף את{" "}
          {related.replaces.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/supplier/products/${r.id}`} className="text-accent hover:underline">
                {offer.product.name}
                {r.brand ? ` של ${r.brand}` : ""}
              </Link>
            </span>
          ))}
          . ללקוחות מוצג שזה תחליף ולא אותו מוצר.
        </p>
      )}
      {offer.pendingBrand && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          ביקשתם לשנות את המותג ל-{offer.pendingBrand}. הבקשה ממתינה לאישור צוות הפלטפורמה, ועד אז מוצג המותג הקודם.
        </p>
      )}

      {held && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          נשמר. שינוי המחיר גדול מ-30%, ולכן הוא ייכנס להשוואות רק אחרי אישור צוות הפלטפורמה.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[14rem_1fr_1fr]">
        <Card title="תמונה">
          <OfferImage offerId={offer.id} src={imageSrc} name={offer.product.name} variant="card" />
          {imageSrc && (
            <form action={removeOfferImage} className="mt-2">
              <input type="hidden" name="offerId" value={offer.id} />
              <button className="text-sm text-danger hover:underline">הסרת התמונה</button>
            </form>
          )}
        </Card>
        <Card title="פרטי המוצר">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="מחירים לפי מדרגה (ללא מע״מ)">
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 text-start font-normal">מדרגה</th>
                <th className="pb-2 text-start font-normal">מחיר פעיל</th>
                <th className="pb-2 text-start font-normal">מבצע</th>
                <th className="pb-2 text-start font-normal">ממתין</th>
              </tr>
            </thead>
            <tbody>
              {supplier.priceTiers.map((t) => {
                const p = byTier.get(t.id);
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2">
                      {t.name}
                      <span className="block text-xs text-muted">מ-{shekels(t.minMonthlyAgorot)} בחודש</span>
                    </td>
                    <td className="py-2">
                      {p?.live != null ? `${shekels(p.live, 2)} / ${unit}` : "—"}
                      {p?.live != null && pricedPerPack(offer) && (
                        <span className="block text-xs text-muted">{packPriceLabel(p.live, pack)}</span>
                      )}
                      {p?.live != null && (
                        <span className="mt-1 block">
                          <PriceStatusBadge kind="REGULAR" updatedAt={p.liveSince} validTo={p.liveValidTo} />
                        </span>
                      )}
                      {p?.live == null && p?.expired && (
                        <span className="block text-xs text-danger">
                          {shekels(p.expired.price, 2)}, התוקף פג ב-{date(lastValidDay(p.expired.validTo))}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {p?.promo != null ? (
                        <>
                          {shekels(p.promo, 2)}
                          <span className="mt-1 block">
                            <PriceStatusBadge kind="PROMOTION" updatedAt={p.promoSince} validTo={p.promoValidTo} />
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      {p?.pending != null ? shekels(p.pending, 2) : "—"}
                      {p?.pendingKind === "PROMOTION" && <span className="block text-xs text-muted">מבצע</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {[...byTier.values()].some((p) => p.promo != null) && (
            <form action={endPromotion} className="mt-3">
              <input type="hidden" name="offerId" value={offer.id} />
              <button className="text-sm text-danger hover:underline">סיום המבצע עכשיו</button>
              <span className="ms-2 text-xs text-muted">המחיר הרגיל יחזור מיד.</span>
            </form>
          )}
          {offer.quantityDeal && (
            <div className="mt-3">
              <DealBadge deal={dealInput(offer.quantityDeal)} unitLabel={unit} />
              {offer.quantityDeal.validTo && offer.quantityDeal.validTo <= new Date() && (
                <span className="text-xs text-danger">המבצע הסתיים ולא מוצג ללקוחות.</span>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            כדי לשנות מחיר, מבצע כמות, סוג מחיר (קבוע, עם תוקף או מבצע) או תאריך סיום, לחצו על &quot;עריכה&quot;.
          </p>
        </Card>
      </div>

      <Card title="יומן שינויים">
        {changes.length === 0 ? (
          <p className="text-sm text-muted">
            עוד לא היו שינויים בפרטי המוצר. כל שינוי בברקוד, במק״ט, באריזה או במותג יישמר כאן.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="text-muted">{date(c.createdAt)}</span>
                <span className="font-medium">{CHANGE_LABEL[c.kind]}</span>
                {(c.oldValue || c.newValue) && (
                  <span>
                    {c.oldValue ?? "ריק"} ← {c.newValue ?? "ריק"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="היסטוריית מחירים">
        {offer.prices.length === 0 ? (
          <p className="text-sm text-muted">אין עדיין מחירים.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 text-start font-normal">תאריך</th>
                <th className="pb-2 text-start font-normal">מדרגה</th>
                <th className="pb-2 text-start font-normal">מחיר</th>
                <th className="pb-2 text-start font-normal">סוג</th>
                <th className="pb-2 text-start font-normal">בתוקף עד</th>
                <th className="pb-2 text-start font-normal">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {offer.prices.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{date(p.createdAt)}</td>
                  <td className="py-2">{p.tier.name}</td>
                  <td className="py-2">{shekels(p.unitPriceAgorot, 2)}</td>
                  <td className="py-2">
                    {p.kind === "PROMOTION" ? KIND_LABEL.PROMOTION : p.termEndsAt ? "עם תוקף" : "קבוע"}
                  </td>
                  <td className="py-2">
                    {p.validTo ? date(lastValidDay(p.validTo)) : "—"}
                    {p.validTo && (!p.termEndsAt || p.validTo < p.termEndsAt) && (
                      <span className="block text-xs text-muted">הוחלף במחיר חדש</span>
                    )}
                  </td>
                  <td className="py-2">{STATUS_LABEL[p.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
