import { responseStats, responseText } from "@/lib/inquiry-deadlines";
import Link from "next/link";
import { VerifiedBadge } from "@/components/verified-badge";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BlockedList, CostBreakdown } from "@/components/effective-cost";
import { Card } from "@/components/form";
import { PlanCard } from "@/components/plan-card";
import { OfferFacts } from "@/components/offer-facts";
import { LOCK_DAYS } from "@/lib/quote-validity";
import { BrandChoices } from "@/components/brand-choices";
import { ProductComparison } from "@/components/product-comparison";
import { SendToSupplierLink } from "@/components/send-to-supplier";
import { requireRole } from "@/lib/auth/current";
import { checkSnapshot, compareChecks, isCheckSnapshot } from "@/lib/customer/checks";
import { rankSuppliers } from "@/lib/customer/fit";
import { volumeRangeFor } from "@/lib/customer/volume";
import { recordSupplierViews } from "@/lib/supplier/stats";
import { analyzeBasket, customerForUser, getBasket, paidComparison } from "@/lib/customer/quotes";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { deleteBasket, recordCheck } from "../../actions";
import { DeleteBasketButton } from "./delete-button";
import { ConfirmForm } from "@/components/confirm-form";
import { db } from "@/lib/db";
import { retentionEnd } from "@/lib/invoices/retention";
import { deleteInvoice } from "../../history/actions";

const SOURCE_LABEL = {
  MANUAL: "רשימה שבניתם",
  TEMPLATE: "רשימה סטנדרטית",
  INVOICE: "מחשבונית",
  CURRENT_SUPPLIER: "לפי הספק הנוכחי",
} as const;

const PREFERENCE_LABEL = { PRICE: "מחיר קודם", BALANCED: "מאוזן", SERVICE: "שירות קודם" } as const;

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
  // הסל והניתוח נטענים במקביל; ניתוח של סל שאינו של הלקוח (או שלא קיים) לא מוצג לעולם
  const [basket, analysis, invoice] = await Promise.all([
    getBasket(customer.id, id),
    analyzeBasket(id).catch(() => null),
    db.invoice.findFirst({ where: { basketId: id, customerId: customer.id }, select: { id: true, createdAt: true } }),
  ]);
  if (!basket || !analysis) notFound();
  // סטטיסטיקת צפיות לספקים נרשמת אחרי שהדף נשלח, כדי לא לעכב את הלקוח
  after(() =>
    recordSupplierViews(
      basket.id,
      customer.id,
      analysis.rows.map((r) => r.supplierId),
    ),
  );
  const { result, rows } = analysis;

  const lastRun = basket.runs[0];
  // ספק שהלקוח חסם מאז הבדיקה לא מופיע ב"מה השתנה"
  const blocked = new Set(
    (
      await db.supplierBlock.findMany({
        where: { customerId: customer.id, mode: "BLOCK" },
        select: { supplierId: true },
      })
    ).map((b) => b.supplierId),
  );
  const compared =
    lastRun && isCheckSnapshot(lastRun.result) && !checked
      ? compareChecks(lastRun.result, checkSnapshot(analysis))
      : null;
  const comparison = compared && {
    ...compared,
    changes: compared.changes.filter((c) => !blocked.has(c.supplierId)),
  };
  const current = basket.currentSupplierId ? rows.find((r) => r.supplierId === basket.currentSupplierId) : undefined;
  const responses = await responseStats(rows.map((r) => r.supplierId));
  const ranked = rankSuppliers(
    rows.map((r) => ({
      response: responses.has(r.supplierId)
        ? { ...responses.get(r.supplierId)!, text: responseText(responses.get(r.supplierId)) }
        : undefined,
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      supplier: r.supplier,
      covered: r.snapshot.lines.length,
      categories: r.categories,
      totalAgorot: r.quote.share.totalAgorot,
      deliveryAgorot: r.quote.share.deliveryAgorot,
      bestAlternativeAgorot: r.quote.bestAlternativeAgorot,
      gapAgorot: r.quote.gapAgorot,
      tierName: r.quote.share.tierName,
    })),
    analysis.lineCount,
    customer.preference,
  );
  const volume = volumeRangeFor(basket.monthlyVolumeMinAgorot);
  // המחירים שהלקוח משלם היום מול ההצעה הזולה במערכת לכל מוצר
  const paid = paidComparison(basket, analysis);
  const yourSupplier = basket.currentSupplier?.companyName ?? basket.currentSupplierName;
  // החלוקה של ההמלצה לפי סוג מוצר (תת-תחום), כדי שיהיה ברור לאיזה ספק הולך כל חלק מהסל
  const categoryOf = new Map(basket.items.map((i) => [i.productId, i.product.category.name]));
  const groups = new Map<
    string,
    { category: string; suppliers: Set<string>; products: string[]; totalAgorot: number }
  >();
  for (const share of (result.recommended ?? result.lowestCost)?.suppliers ?? []) {
    for (const line of share.lines) {
      const category = categoryOf.get(line.productId) ?? "אחר";
      const g = groups.get(category) ?? { category, suppliers: new Set(), products: [], totalAgorot: 0 };
      g.suppliers.add(share.supplierName);
      g.products.push(line.productName);
      g.totalAgorot += line.lineTotalAgorot;
      groups.set(category, g);
    }
  }
  const routing = [...groups.values()]
    .map((g) => ({ ...g, suppliers: [...g.suppliers] }))
    .sort((a, b) => b.totalAgorot - a.totalAgorot);

  // השורה התחתונה: ההמלצה, החיסכון, ולמי לשלוח הודעה
  const plan = result.recommended ?? result.lowestCost;
  const saving =
    paid.monthlySavingAgorot > 0
      ? { agorot: paid.monthlySavingAgorot, against: "מול המחירים שמילאתם" }
      : current && current.quote.gapAgorot > 0
        ? { agorot: current.quote.gapAgorot, against: `מול ${current.supplierName}` }
        : null;
  const sections = [
    comparison && lastRun ? { id: "changes", label: "מה השתנה" } : null,
    { id: "options", label: "שלוש אפשרויות" },
    paid.lines.length > 0 ? { id: "prices", label: "המחירים שלכם" } : null,
    ranked.length > 0 ? { id: "suppliers", label: "ספקים מתאימים" } : null,
    routing.length > 0 ? { id: "routing", label: "ספק לכל סוג מוצר" } : null,
    { id: "items", label: `המוצרים (${basket.items.length})` },
  ].filter((x) => x !== null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{basket.name}</h1>
          <p className="text-sm text-muted">
            {SOURCE_LABEL[basket.source]}
            {yourSupplier ? ` · הספק שלכם היום: ${yourSupplier}` : ""} · {basket.items.length} מוצרים ·{" "}
            {basket.deliveriesPerMonth} אספקות בחודש · נוצר {date(basket.createdAt)}
          </p>
          <p className="text-sm text-muted">
            {volume
              ? `היקף רכש: ${volume.label} בחודש. מדרגות המחיר אצל כל ספק חושבו לפי ההיקף הזה (לפי הגבול התחתון).`
              : "מדרגות המחיר חושבו לפי הסל בלבד. אם אתם קונים יותר בחודש, עדכנו את היקף הרכש בעריכת הסל."}
          </p>
        </div>
        <div data-needs="buy" className="flex items-center gap-4 text-sm">
          <Link href={`/customer/baskets/${basket.id}/edit`} className="text-accent hover:underline">
            עריכת הסל
          </Link>
          <DeleteBasketButton basketId={basket.id} name={basket.name} action={deleteBasket} />
        </div>
      </div>

      {invoice && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            הסל נבנה מחשבונית. השורות שקראנו ממנה נשמרות עד {retentionEnd(invoice.createdAt)} ואז נמחקות אוטומטית. הסל
            עצמו נשאר.
          </p>
          <ConfirmForm
            needs="buy"
            action={deleteInvoice}
            fields={{ id: invoice.id, back: `/customer/baskets/${basket.id}` }}
            confirm="למחוק עכשיו את השורות שנקראו מהחשבונית? הסל לא יימחק."
          >
            מחיקת החשבונית עכשיו
          </ConfirmForm>
        </div>
      )}

      {checked && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          {checked === "saved" ? "הסל נשמר והופיע בסרגל. " : ""}המחירים של היום נשמרו. בכניסה הבאה תראו כאן מה השתנה אצל
          כל ספק מאז היום.
        </p>
      )}

      {plan && (
        <section aria-labelledby="bottom-line" className="rounded-lg border border-accent bg-surface p-5">
          <h2 id="bottom-line" className="mb-3 font-semibold">
            השורה התחתונה
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted">{result.recommended ? "ההמלצה שלנו" : "האפשרות הזולה"}</p>
              <p className="text-3xl font-bold">{shekels(plan.totalAgorot)}</p>
              <p className="text-xs text-muted">
                לחודש, ללא מע״מ, אצל {plan.suppliers.map((s) => s.supplierName).join(" + ")}
              </p>
            </div>
            {current ? (
              <div>
                <p className="text-sm text-muted">הספק שלכם היום</p>
                <p className="text-3xl font-bold">{shekels(current.quote.share.totalAgorot)}</p>
                <p className="text-xs text-muted">לחודש לפי המחירון של {current.supplierName}</p>
              </div>
            ) : (
              basket.currentSupplierId && (
                <div>
                  <p className="text-sm text-muted">הספק שלכם היום</p>
                  <p className="text-sm text-muted">
                    לא הצלחנו לתמחר את הסל אצלו (ייתכן שהסל קטן ממינימום ההזמנה שלו).
                  </p>
                </div>
              )
            )}
            <div className="rounded-lg bg-accent-soft p-3">
              <p className="text-sm">חיסכון אפשרי</p>
              <p className="text-3xl font-bold text-accent">{saving ? shekels(saving.agorot) : "אין"}</p>
              <p className="text-xs text-muted">
                {saving
                  ? `בחודש ${saving.against}, ${shekels(saving.agorot * 12)} בשנה`
                  : "המחירים שלכם כבר טובים לסל הזה. אפשר עדיין לבקש הצעה."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {plan.suppliers
              .filter((s) => s.supplierId !== basket.currentSupplierId)
              .map((s) => (
                <SendToSupplierLink
                  key={s.supplierId}
                  href={`/customer/baskets/${basket.id}/inquiry/${s.supplierId}`}
                  label={`הודעה ל${s.supplierName}`}
                />
              ))}
          </div>
        </section>
      )}

      <nav aria-label="חלקי הדף" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
        {sections.map((x) => (
          <a
            key={x.id}
            href={`#${x.id}`}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-muted hover:border-accent hover:text-accent"
          >
            {x.label}
          </a>
        ))}
      </nav>

      {comparison && lastRun && (
        <Card id="changes" title={`מה השתנה מאז הבדיקה ב-${date(lastRun.createdAt)}`}>
          <div className="flex flex-col gap-3 text-sm">
            {comparison.lowestDeltaAgorot !== null && (
              <p>
                העלות הזולה ביותר לסל: {shekels(lastRun.bestCostAgorot)} ←{" "}
                <strong>{shekels(result.lowestCost?.totalAgorot ?? 0)}</strong> (
                <Delta agorot={comparison.lowestDeltaAgorot} />)
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
                          {shekels(c.beforeAgorot!)} ← {shekels(c.afterAgorot!)} ·{" "}
                          <Delta agorot={c.afterAgorot! - c.beforeAgorot!} />
                        </>
                      )}
                      {c.kind === "new" && <span className="text-accent">הצעה חדשה: {shekels(c.afterAgorot!)}</span>}
                      {c.kind === "gone" && <span className="text-muted">כבר לא מציע את המוצרים האלה</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={recordCheck} data-needs="buy">
              <input type="hidden" name="basketId" value={basket.id} />
              <button className="text-sm text-accent hover:underline">
                סימון כנבדק: ההשוואה הבאה תהיה מול המחירים של היום
              </button>
            </form>
          </div>
        </Card>
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

      <h2 id="options" className="scroll-mt-4 font-semibold">
        שלוש אפשרויות לסל
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard title="המלצה" plan={result.recommended} />
        <PlanCard title="העלות הנמוכה ביותר" plan={result.lowestCost} />
        <PlanCard title="ספק יחיד" plan={result.singleSupplier} />
      </div>
      <p className="-mt-2 text-xs text-muted">
        כל המחירים ללא מע״מ. נבדקו {result.evaluatedCombinations} צירופי ספקים. אחרי ששולחים פנייה לספק, המחירים שבהצעה
        נשמרים לכם {LOCK_DAYS} ימים.
      </p>

      {!basket.savedAt && (
        <div
          data-needs="buy"
          className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">שמירת הסל לבדיקה חודשית</p>
            <p className="text-sm text-muted">
              נשמור את המחירים של היום. בכל חודש תיכנסו מהסרגל ותראו אם ספק מתחרה שינה מחיר או אם יש היום אפשרות זולה
              יותר.
            </p>
          </div>
          <form action={recordCheck} data-needs="buy">
            <input type="hidden" name="basketId" value={basket.id} />
            <button className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
              שמירת הסל
            </button>
          </form>
        </div>
      )}

      {analysis.brandChoices.length > 0 && (
        <Card title="המותגים שביקשתם">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              בכל מוצר שבחרתם לו מותג ההשוואה כוללת רק את המותג הזה. כשיש מוצר דומה ממותג אחר שזול יותר, נראה אותו כאן
              כדי שתחליטו בעצמכם.
            </p>
            <BrandChoices choices={analysis.brandChoices} />
          </div>
        </Card>
      )}

      {paid.lines.length > 0 && (
        <Card id="prices" title="המחירים שלכם היום מול המערכת">
          <div className="flex flex-col gap-4">
            {paid.monthlySavingAgorot > 0 ? (
              <div className="rounded-lg bg-accent-soft p-4">
                <p className="text-sm">
                  מצאנו מחיר טוב יותר ל-{paid.suppliers.reduce((n, s) => n + s.products.length, 0)} מתוך{" "}
                  {paid.lines.length} המוצרים שמילאתם להם מחיר{yourSupplier ? ` (מול ${yourSupplier})` : ""}
                </p>
                <p className="text-3xl font-bold text-accent">חיסכון של עד {shekels(paid.monthlySavingAgorot)} בחודש</p>
                <p className="text-sm text-muted">
                  {shekels(paid.monthlySavingAgorot * 12)} בשנה. כולל מינימום ההזמנה של כל ספק, לפי{" "}
                  {basket.deliveriesPerMonth} אספקות בחודש.
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-background px-4 py-3 text-sm">
                {paid.blocked.length > 0
                  ? "יש ספקים שזולים יותר ליחידה, אבל בגלל מינימום ההזמנה זה לא משתלם כרגע (פירוט למטה)."
                  : "המחירים שאתם משלמים היום טובים או שווים למה שיש כרגע במערכת."}{" "}
                אפשר עדיין לפנות לספק ולבקש הצעה.
              </p>
            )}

            <details className="group rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                <span className="group-open:hidden">הצגת</span>
                <span className="hidden group-open:inline">הסתרת</span> ההשוואה לכל מוצר ({paid.lines.length} מוצרים)
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <ProductComparison lines={paid.lines} currentSupplierId={basket.currentSupplierId} />
                <p className="text-xs text-muted">
                  מחיר קבוע: בלי תאריך סיום. מחיר עם תוקף: הספק התחייב אליו עד התאריך. מבצע: מחיר מוזל עד התאריך, ואחריו
                  חוזר המחיר הרגיל. תאריך עדכון באדום: עבר יותר מחודש, כדאי לוודא מול הספק. כל המחירים ללא מע״מ.
                </p>
              </div>
            </details>

            {paid.suppliers.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">אפשרויות להוזלה אצל ספקים במערכת</p>
                <ul className="flex flex-col gap-2">
                  {paid.suppliers.map((s) => (
                    <li
                      key={s.supplierId}
                      className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {s.supplierName}
                          <VerifiedBadge supplierId={s.supplierId} />
                          {s.supplierId === basket.currentSupplierId && (
                            <span className="ms-2 rounded bg-background px-2 py-0.5 text-xs text-muted">הספק שלכם</span>
                          )}
                        </p>
                        <p className="text-sm text-muted">
                          חיסכון של {shekels(s.monthlySavingAgorot)} בחודש על {s.products.join(", ")}
                        </p>
                        <CostBreakdown cost={s.cost} />
                        <div className="mt-2">
                          <OfferFacts
                            supplierId={s.supplierId}
                            totalAgorot={s.cost.totalAgorot}
                            lines={paid.lines
                              .filter((l) => s.productIds.includes(l.productId))
                              .flatMap((l) => l.offers.filter((o) => o.supplierId === s.supplierId))}
                          />
                        </div>
                      </div>
                      <SendToSupplierLink href={`/customer/baskets/${basket.id}/inquiry/${s.supplierId}`} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  המחירים במערכת הם מהמחירון של כל ספק, לפי מדרגת ההיקף שלכם. ההוזלה תקפה אחרי שהספק מאשר אותה בתשובה
                  להודעה שלכם.
                </p>
              </div>
            )}
            <BlockedList items={paid.blocked} />
          </div>
        </Card>
      )}

      {ranked.length > 0 && (
        <Card id="suppliers" title="לאיזה ספקים הסל שלכם מכוון">
          <p className="mb-3 text-sm text-muted">
            הספקים שמתאימים לסל שסימנתם, מהמתאים ביותר: לפי כמה מהסל כל ספק מכסה, כמה הוא יקר מהחלופה הזולה לאותם
            מוצרים, ודירוג ואמינות לפי ההעדפה שלכם ({PREFERENCE_LABEL[customer.preference]}).
          </p>
          <ol className="flex flex-col gap-3">
            {ranked.map((r, i) => (
              <li
                key={r.supplierId}
                className={`rounded-lg border p-4 ${i === 0 ? "border-accent bg-accent-soft/40" : "border-border"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.supplierName}
                        <VerifiedBadge supplierId={r.supplierId} />
                        {r.supplierId === basket.currentSupplierId && (
                          <span className="ms-2 rounded bg-background px-2 py-0.5 text-xs text-muted">הספק שלכם</span>
                        )}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.labels.map((l) => (
                          <span key={l} className="rounded bg-accent px-2 py-0.5 text-xs text-white">
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xl font-bold">{shekels(r.totalAgorot)}</span>
                    <span className="text-xs text-muted">לחודש ל-{r.covered} מוצרים</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2" aria-label={`התאמה ${r.score}%`}>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${r.score}%` }} />
                  </span>
                  <span className="w-20 text-xs text-muted">התאמה {r.score}%</span>
                </div>
                <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-sm text-muted sm:grid-cols-2">
                  {r.reasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>
                <div className="mt-3">
                  <OfferFacts
                    supplierId={r.supplierId}
                    totalAgorot={r.totalAgorot}
                    lines={rows.find((row) => row.supplierId === r.supplierId)?.quote.share.lines ?? []}
                  />
                </div>
                <div className="mt-3">
                  <SendToSupplierLink href={`/customer/baskets/${basket.id}/inquiry/${r.supplierId}`} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {routing.length > 0 && (
        <details id="routing" className="scroll-mt-4 rounded-lg border border-border bg-surface p-5">
          <summary className="cursor-pointer font-semibold">איזה ספק לכל סוג מוצר ({routing.length} סוגים)</summary>
          <p className="my-3 text-sm text-muted">
            לפי ההמלצה: כל קבוצת מוצרים הולכת לספק שמשתלם לה, למשל ירקות אדמה לספק אחד וירוקים לספק שמתמחה בהם.
          </p>
          <ul className="divide-y divide-border text-sm">
            {routing.map((g) => (
              <li key={g.category} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{g.category}</p>
                  <p className="text-xs text-muted">{g.products.join(", ")}</p>
                </div>
                <div className="text-end">
                  <p>{g.suppliers.join(" + ")}</p>
                  <p className="text-xs text-muted">{shekels(g.totalAgorot)} לחודש</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details id="items" className="scroll-mt-4 rounded-lg border border-border bg-surface p-5">
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
                  <td className="py-2">
                    {i.currentUnitPriceAgorot !== null ? shekels(i.currentUnitPriceAgorot, 2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
