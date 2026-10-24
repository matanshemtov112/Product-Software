import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { PlanCard } from "@/components/plan-card";
import { requireRole } from "@/lib/auth/current";
import { checkSnapshot, compareChecks, isCheckSnapshot } from "@/lib/customer/checks";
import { analyzeBasket, customerForUser, getBasket } from "@/lib/customer/quotes";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { deleteBasket, recordCheck } from "../../actions";
import { DeleteBasketButton } from "./delete-button";

const SOURCE_LABEL = {
  MANUAL: "רשימה שבניתם",
  TEMPLATE: "רשימה סטנדרטית",
  CURRENT_SUPPLIER: "לפי הספק הנוכחי",
} as const;

const date = (d: Date) => d.toLocaleDateString("he-IL");

/** סכום שינוי עם סימן וצבע: ירידה בירוק, עלייה באדום */
function Delta({ agorot }: { agorot: number }) {
  if (agorot === 0) return <span className="text-muted">ללא שינוי</span>;
  return (
    <span className={agorot < 0 ? "font-medium text-accent" : "font-medium text-danger"}>
      {agorot < 0 ? `ירד ב-${shekels(-agorot)}` : `עלה ב-${shekels(agorot)}`}
    </span>
  );
}

export default async function BasketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checked?: string }>;
}) {
  const { id } = await params;
  const { checked } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const basket = await getBasket(customer.id, id);
  if (!basket) notFound();
  const analysis = await analyzeBasket(basket.id);
  const { result, rows } = analysis;

  const lastRun = basket.runs[0];
  const comparison =
    lastRun && isCheckSnapshot(lastRun.result) && !checked
      ? compareChecks(lastRun.result, checkSnapshot(analysis))
      : null;
  const current = basket.currentSupplierId ? rows.find((r) => r.supplierId === basket.currentSupplierId) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{basket.name}</h1>
          <p className="text-sm text-muted">
            {SOURCE_LABEL[basket.source]}
            {basket.currentSupplier ? `: ${basket.currentSupplier.companyName}` : ""} · {basket.items.length} מוצרים ·{" "}
            {basket.deliveriesPerMonth} אספקות בחודש · נוצר {date(basket.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href={`/customer/baskets/${basket.id}/edit`} className="text-accent hover:underline">
            עריכת הסל
          </Link>
          <DeleteBasketButton basketId={basket.id} name={basket.name} action={deleteBasket} />
        </div>
      </div>

      {checked && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          {checked === "saved" ? "הסל נשמר והופיע בסרגל. " : ""}המחירים של היום נשמרו. בכניסה הבאה תראו כאן מה השתנה אצל כל ספק מאז היום.
        </p>
      )}

      {comparison && lastRun && (
        <Card title={`מה השתנה מאז הבדיקה ב-${date(lastRun.createdAt)}`}>
          <div className="flex flex-col gap-3 text-sm">
            {comparison.lowestDeltaAgorot !== null && (
              <p>
                העלות הזולה ביותר לסל: {shekels(lastRun.bestCostAgorot)} ←{" "}
                <strong>{shekels(result.lowestCost?.totalAgorot ?? 0)}</strong> (<Delta agorot={comparison.lowestDeltaAgorot} />
                )
              </p>
            )}
            {comparison.changes.length === 0 ? (
              <p className="text-muted">אף ספק לא שינה מחיר לסל שלכם.</p>
            ) : (
              <ul className="divide-y divide-border">
                {comparison.changes.map((c) => (
                  <li key={c.supplierId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {c.name}
                      {c.supplierId === basket.currentSupplierId && <span className="text-muted"> (הספק שלכם)</span>}
                    </span>
                    <span>
                      {c.kind === "changed" && (
                        <>
                          {shekels(c.beforeAgorot!)} ← {shekels(c.afterAgorot!)} · <Delta agorot={c.afterAgorot! - c.beforeAgorot!} />
                        </>
                      )}
                      {c.kind === "new" && <span className="text-accent">הצעה חדשה: {shekels(c.afterAgorot!)}</span>}
                      {c.kind === "gone" && <span className="text-muted">כבר לא מציע את המוצרים האלה</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={recordCheck}>
              <input type="hidden" name="basketId" value={basket.id} />
              <button className="text-sm text-accent hover:underline">
                סימון כנבדק: ההשוואה הבאה תהיה מול המחירים של היום
              </button>
            </form>
          </div>
        </Card>
      )}

      {!basket.savedAt && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">שמירת הסל לבדיקה חודשית</p>
            <p className="text-sm text-muted">
              נשמור את המחירים של היום. בכל חודש תיכנסו מהסרגל ותראו אם ספק מתחרה שינה מחיר או אם יש היום אפשרות זולה יותר.
            </p>
          </div>
          <form action={recordCheck}>
            <input type="hidden" name="basketId" value={basket.id} />
            <button className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">שמירת הסל</button>
          </form>
        </div>
      )}

      {current && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">הספק שלכם היום</p>
            <p className="font-medium">{current.supplierName}</p>
            <p className="text-2xl font-bold">{shekels(current.quote.share.totalAgorot)}</p>
            <p className="text-xs text-muted">לחודש לפי המחירון שלו, כולל משלוחים</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">החלופה הזולה ביותר לאותם מוצרים</p>
            <p className="text-2xl font-bold">{shekels(current.quote.bestAlternativeAgorot)}</p>
            <p className="text-xs text-muted">מספק מתחרה או משילוב ספקים, פירוט למטה</p>
          </div>
          <div className="rounded-lg bg-accent-soft p-4">
            <p className="text-sm">חיסכון אפשרי</p>
            <p className="text-2xl font-bold text-accent">
              {current.quote.gapAgorot ? shekels(current.quote.gapAgorot) : "אין"}
            </p>
            <p className="text-xs text-muted">
              {current.quote.gapAgorot
                ? `בחודש, ${shekels(current.quote.gapAgorot * 12)} בשנה`
                : "הספק שלכם כבר הזול ביותר לסל הזה"}
            </p>
          </div>
        </div>
      )}
      {basket.currentSupplierId && !current && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
          לא הצלחנו לתמחר את הסל אצל הספק הנוכחי שלכם (ייתכן שהסל קטן ממינימום ההזמנה שלו).
        </p>
      )}

      {!current && result.monthlySavingsAgorot !== null && result.monthlySavingsAgorot > 0 && (
        <div className="rounded-lg bg-accent-soft p-5">
          <p className="text-sm">חיסכון חודשי אפשרי</p>
          <p className="text-3xl font-bold text-accent">{shekels(result.monthlySavingsAgorot)}</p>
          <p className="text-sm text-muted">{shekels(result.annualSavingsAgorot!)} בשנה, מול המחירים שאתם משלמים היום</p>
        </div>
      )}

      {!result.lowestCost && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
          אף ספק או שילוב ספקים לא מתאים לסל כרגע. לרוב זה קורה כשההזמנה לכל אספקה קטנה ממינימום ההזמנה של הספקים: נסו
          פחות אספקות בחודש, כמויות גדולות יותר, או להוסיף מוצרים.{" "}
          <Link href={`/customer/baskets/${basket.id}/edit`} className="text-accent">
            עריכת הסל
          </Link>
        </p>
      )}

      <h2 className="font-semibold">שלוש אפשרויות לסל</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard title="המלצה" plan={result.recommended} />
        <PlanCard title="העלות הנמוכה ביותר" plan={result.lowestCost} />
        <PlanCard title="ספק יחיד" plan={result.singleSupplier} />
      </div>
      <p className="-mt-2 text-xs text-muted">כל המחירים ללא מע״מ. נבדקו {result.evaluatedCombinations} צירופי ספקים.</p>

      {rows.length > 0 && (
        <Card title={current ? "הספקים המתחרים" : "ההצעה של כל ספק"}>
          <p className="mb-3 text-sm text-muted">
            ההצעה של כל ספק לסל, מול החלופה הזולה ביותר לאותם מוצרים. אם אתם מעדיפים ספק מסוים והפער קטן, אפשר לשלוח לו
            פנייה עם ההצעה.
          </p>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.supplierId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {r.supplierName}
                    {r.supplierId === basket.currentSupplierId && (
                      <span className="ms-2 rounded bg-background px-2 py-0.5 text-xs text-muted">הספק שלכם</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {r.snapshot.lines.length} מתוך {analysis.lineCount} מוצרים · {shekels(r.quote.share.totalAgorot)} לחודש
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm ${r.quote.gapAgorot ? "" : "font-medium text-accent"}`}>
                    {r.quote.gapAgorot ? `יקר ב-${shekels(r.quote.gapAgorot)}` : "הכי זול לאותם מוצרים"}
                  </span>
                  <Link
                    href={`/customer/baskets/${basket.id}/inquiry/${r.supplierId}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    פנייה לספק
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="rounded-lg border border-border bg-surface p-5">
        <summary className="cursor-pointer font-semibold">המוצרים בסל ({basket.items.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 text-start font-normal">מוצר</th>
                <th className="pb-2 text-start font-normal">כמות בחודש</th>
                <th className="pb-2 text-start font-normal">מחיר היום</th>
              </tr>
            </thead>
            <tbody>
              {basket.items.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2">{i.product.name}</td>
                  <td className="py-2">
                    {i.monthlyQuantity} {UNIT_LABEL[i.product.unit]}
                  </td>
                  <td className="py-2">{i.currentUnitPriceAgorot !== null ? shekels(i.currentUnitPriceAgorot, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
