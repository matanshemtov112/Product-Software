import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { shekels } from "@/lib/format";
import { pricedPerPack, minOrderLabel, packLabel, packPriceLabel } from "@/lib/pack";
import { getOffer, offerImageUrl, pricesByTier, supplierForUser, UNIT_LABEL } from "@/lib/supplier/catalog";
import { removeOfferImage } from "../../actions";
import { OfferImage } from "../../offer-image";
import { DeleteOfferButton } from "../../delete-button";

const STATUS_LABEL = { LIVE: "פעיל", PENDING_APPROVAL: "ממתין לאישור", REJECTED: "נדחה" } as const;
const KIND_LABEL = { REGULAR: "רגיל", PROMOTION: "מבצע" } as const;

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

  const details = [
    ["סוג מוצר", offer.product.category.name],
    ["יחידת מכירה", unit],
    ["איך המוצר מגיע", packLabel(pack)],
    ["כמות מינימלית להזמנה", minOrderLabel(pack) ?? "אין"],
    ["השם שלכם למוצר", offer.supplierProductName ?? "לא צוין"],
    ["מותג", offer.brand ?? "לא צוין"],
    ['מק"ט', offer.supplierSku ?? "לא צוין"],
    ["זמינות", offer.available ? "זמין" : "לא זמין"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/supplier" className="text-sm text-muted hover:text-foreground">
            → חזרה לרשימה
          </Link>
          <h1 className="text-2xl font-bold">{offer.product.name}</h1>
          {offer.product.pendingReview && (
            <p className="text-sm text-muted">מוצר חדש בקטלוג, ממתין לבדיקת צוות הפלטפורמה.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/supplier/products/${offer.id}/edit`}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white"
          >
            עריכה
          </Link>
          <DeleteOfferButton offerId={offer.id} productName={offer.product.name} />
        </div>
      </div>

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
                    </td>
                    <td className="py-2">{p?.pending != null ? shekels(p.pending, 2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

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
                <th className="pb-2 text-start font-normal">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {offer.prices.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{date(p.createdAt)}</td>
                  <td className="py-2">{p.tier.name}</td>
                  <td className="py-2">{shekels(p.unitPriceAgorot, 2)}</td>
                  <td className="py-2">{KIND_LABEL[p.kind]}</td>
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
