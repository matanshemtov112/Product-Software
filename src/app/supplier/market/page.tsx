import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { shekels } from "@/lib/format";
import { supplierForUser } from "@/lib/supplier/catalog";
import { MARKET_BAND_LABEL, MIN_SUPPLIERS, type MarketBand } from "@/lib/supplier/market";
import { supplierMarket } from "@/lib/supplier/market-load";

const BAND_STYLE: Record<MarketBand, string> = {
  CHEAPEST: "bg-accent-soft text-accent",
  CLOSE: "bg-accent-soft text-foreground",
  MID: "bg-[#fff4c2] text-[#6b5500]",
  HIGH: "bg-background text-danger",
};

const BANDS: MarketBand[] = ["CHEAPEST", "CLOSE", "MID", "HIGH"];

export default async function SupplierMarket() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const rows = await supplierMarket(supplier.id);
  const ranked = rows.filter((r) => r.position);
  const count = (band: MarketBand) => ranked.filter((r) => r.position!.band === band).length;
  // היקרים קודם: שם יש הכי הרבה מה לעשות
  const order = (r: (typeof rows)[number]) => (r.position ? -BANDS.indexOf(r.position.band) : 1);
  const sorted = [...rows].sort((a, b) => order(a) - order(b));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מיקום מול השוק</h1>
        <p className="text-sm text-muted">
          איפה המחיר שלכם עומד מול ספקים אחרים שמוכרים את אותו מוצר, לפי המחירון הבסיסי וללא מע״מ. מחיר השוק הוא המחיר
          האמצעי מבין כל הספקים. לא מוצגים שמות של ספקים אחרים או המחיר של ספק מסוים, ומוצר שמוכרים פחות מ-
          {MIN_SUPPLIERS} ספקים לא מדורג.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {BANDS.map((band) => (
          <div key={band} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">{MARKET_BAND_LABEL[band]}</p>
            <p className="text-2xl font-bold">{count(band)}</p>
            <p className="text-xs text-muted">מוצרים</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">המוצרים שלכם</h2>
        <p className="mb-3 text-sm text-muted">
          מוצר שהמחיר שלו גבוה ביותר מ-10% מהזול כמעט לא ייבחר בהשוואה. שווה לבדוק אותו קודם.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">עדיין אין לכם מוצרים עם מחיר פעיל.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((r) => (
              <li key={r.offerId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{r.productName}</p>
                  <p className="text-sm text-muted">
                    {r.category} · המחיר שלכם {shekels(r.ownAgorot, 2)} ל{r.unitLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  {r.position ? (
                    <>
                      <span className={`rounded px-2 py-0.5 ${BAND_STYLE[r.position.band]}`}>
                        {MARKET_BAND_LABEL[r.position.band]}
                      </span>
                      <span className="text-muted">
                        מקום {r.position.rank} מתוך {r.position.suppliers} · מחיר שוק{" "}
                        {shekels(r.position.medianAgorot, 2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">מעט מדי ספקים להשוואה</span>
                  )}
                  <Link href={`/supplier/products/${r.offerId}/edit`} className="text-accent hover:underline">
                    עדכון מחיר
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
