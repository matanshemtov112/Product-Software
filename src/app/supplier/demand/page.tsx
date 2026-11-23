import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { paywallActive, supplierCanUse } from "@/lib/billing/plans";
import { supplierForUser } from "@/lib/supplier/catalog";
import { demandForSupplier, MIN_BUSINESSES, WINDOW_DAYS, type DemandProduct, type Trend } from "@/lib/supplier/demand";

const TREND: Record<Trend, { label: string; className: string } | null> = {
  new: { label: "ביקוש חדש", className: "bg-accent-soft text-accent" },
  rising: { label: "בעלייה", className: "bg-accent-soft text-accent" },
  steady: null,
};

function Row({ r }: { r: DemandProduct }) {
  const trend = TREND[r.trend];
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">
          {r.name} <span className="text-xs font-normal text-muted">· {r.category}</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded bg-background px-2 py-0.5">{r.level} עסקים בדקו</span>
          {trend && <span className={`rounded px-2 py-0.5 ${trend.className}`}>{trend.label}</span>}
          {r.fewAlternatives && (
            <span className="rounded bg-[#fff4c2] px-2 py-0.5 text-[#6b5500]">מעט ספקים מגיעים אליהם</span>
          )}
          {r.seekingAlternative && (
            <span className="rounded bg-[#fff4c2] px-2 py-0.5 text-[#6b5500]">עסקים שמחפשים ספק נוסף</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 text-sm" data-needs="prices">
        {r.offerId ? (
          <>
            <Link
              href={`/supplier/products/${r.offerId}/edit?back=demand`}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-background"
            >
              עדכון מחיר
            </Link>
            <Link
              href={`/supplier/products/${r.offerId}/edit?deal=1&back=demand#deal`}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-background"
            >
              הצעת מבצע
            </Link>
          </>
        ) : (
          <Link
            href={`/supplier/products/new?product=${r.productId}`}
            className="rounded-md bg-accent px-3 py-1.5 font-medium text-white"
          >
            הוספת המוצר למחירון
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function SupplierDemand() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const allowed = await supplierCanUse(supplier.id, "demandInsights");
  const rows = allowed ? await demandForSupplier(supplier.id) : [];
  const missing = rows.filter((r) => !r.sells);
  const selling = rows.filter((r) => r.sells);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ביקוש באזור</h1>
        <p className="text-sm text-muted">
          המוצרים שעסקים באזורי החלוקה שלכם בדקו ב-{WINDOW_DAYS} הימים האחרונים, בהשוואות מחירים, בחשבוניות ובחיפוש
          בצילום. כך אפשר לפנות לביקוש ולא רק לחכות לפניות.
        </p>
        <p className="mt-1 text-xs text-muted">
          הכול חסוי: מוצר מופיע רק כשלפחות {MIN_BUSINESSES} עסקים שונים בדקו אותו, והמספר מוצג בטווח. לא מוצגים שמות
          עסקים, כמויות, מחירים או פרטים מחשבוניות.
          {!paywallActive() && " בתקופת ההשקה הדף פתוח לכל הספקים ללא תשלום."}
        </p>
      </div>

      {!allowed ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">זמין למנויים</h2>
          <p className="text-sm text-muted">
            ביקוש באזור הוא חלק מהמנוי. פנו אלינו כדי להצטרף ולראות אילו מוצרים עסקים באזור שלכם מחפשים.
          </p>
        </section>
      ) : rows.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-muted">
            עדיין אין מספיק בדיקות באזור שלכם כדי להציג ביקוש. כשלפחות {MIN_BUSINESSES} עסקים יבדקו את אותו מוצר, הוא
            יופיע כאן ותקבלו התראה.
          </p>
        </section>
      ) : (
        <>
          {missing.length > 0 && (
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold">מוצרים שמחפשים באזור ואתם עוד לא מוכרים</h2>
              <p className="mb-2 text-sm text-muted">מוצרים מהתחומים שלכם. הוספה למחירון תכניס אתכם להשוואות שלהם.</p>
              <ul className="divide-y divide-border">
                {missing.map((r) => (
                  <Row key={r.productId} r={r} />
                ))}
              </ul>
            </section>
          )}
          {selling.length > 0 && (
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold">מוצרים שלכם עם ביקוש</h2>
              <p className="mb-2 text-sm text-muted">מחיר מעודכן או מבצע כמות יבליטו אתכם בהשוואות של העסקים האלה.</p>
              <ul className="divide-y divide-border">
                {selling.map((r) => (
                  <Row key={r.productId} r={r} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
