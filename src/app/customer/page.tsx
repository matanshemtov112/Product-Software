import Link from "next/link";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { optimizeBasket, type Plan } from "@/lib/engine";
import { loadEngineInput } from "@/lib/engine/load";
import { basketQuotes, customerForUser } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

const PREFERENCE_LABEL = { PRICE: "מחיר קודם", BALANCED: "מאוזן", SERVICE: "שירות קודם" } as const;

function PlanCard({ title, plan }: { title: string; plan: Plan | null }) {
  return (
    <Card title={title}>
      {plan ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-2xl font-bold">{shekels(plan.totalAgorot)}</p>
          <ul className="flex flex-col gap-1 text-muted">
            {plan.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">אין ספקים מתאימים לסל הזה עדיין.</p>
      )}
    </Card>
  );
}

export default async function CustomerHome({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const basket = customer.baskets[0];
  const [result, quotes, inquiries] = await Promise.all([
    basket
      ? loadEngineInput(basket.id).then(({ lines, suppliers, options }) => optimizeBasket(lines, suppliers, options))
      : null,
    basket ? basketQuotes(basket.id) : null,
    db.negotiationRequest.findMany({
      where: { customerId: customer.id },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{customer.businessName}</h1>
        <p className="text-muted">
          {customer.businessType} · {customer.city} · {customer.region.name} · העדפה: {PREFERENCE_LABEL[customer.preference]}
        </p>
      </div>

      {!basket || !result ? (
        <Card title="הסל החודשי">
          <p className="text-sm text-muted">בניית סל תיפתח בשלב הבא. בינתיים אפשר לראות את חשבון הדמו.</p>
        </Card>
      ) : (
        <>
          {result.monthlySavingsAgorot !== null && result.monthlySavingsAgorot > 0 && (
            <div className="rounded-lg bg-accent-soft p-5">
              <p className="text-sm">חיסכון חודשי אפשרי</p>
              <p className="text-3xl font-bold text-accent">{shekels(result.monthlySavingsAgorot)}</p>
              <p className="text-sm text-muted">{shekels(result.annualSavingsAgorot!)} בשנה, מול העלות הנוכחית שלכם</p>
            </div>
          )}
          <h2 className="font-semibold">השוואה ל{basket.name}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <PlanCard title="המלצה" plan={result.recommended} />
            <PlanCard title="העלות הנמוכה ביותר" plan={result.lowestCost} />
            <PlanCard title="ספק יחיד" plan={result.singleSupplier} />
          </div>
          <p className="text-xs text-muted">כל המחירים ללא מע״מ. נבדקו {result.evaluatedCombinations} צירופי ספקים.</p>
        </>
      )}

      {quotes && quotes.rows.length > 0 && (
        <Card title="רוצים לעבוד עם ספק מסוים?">
          <p className="mb-3 text-sm text-muted">
            ההצעה של כל ספק לסל שלכם, מול החלופה הזולה ביותר לאותם מוצרים. אם הפער קטן ואתם מעדיפים את הספק, אפשר
            לשלוח לו פנייה עם ההצעה.
          </p>
          <ul className="divide-y divide-border">
            {quotes.rows.map((r) => (
              <li key={r.supplierId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{r.supplierName}</p>
                  <p className="text-sm text-muted">
                    {r.snapshot.lines.length} מתוך {quotes.lineCount} מוצרים · {shekels(r.quote.share.totalAgorot)} לחודש
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm ${r.quote.gapAgorot ? "" : "font-medium text-accent"}`}>
                    {r.quote.gapAgorot ? `יקר ב-${shekels(r.quote.gapAgorot)}` : "הכי זול לאותם מוצרים"}
                  </span>
                  <Link
                    href={`/customer/inquiry/${r.supplierId}`}
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

      <section id="inquiries">
        <Card title="הפניות שלי">
          {sent && (
            <p role="status" className="mb-3 rounded-md bg-accent-soft px-3 py-2 text-sm">
              הפנייה נשלחה לספק. התשובה תופיע כאן.
            </p>
          )}
          {inquiries.length === 0 ? (
            <p className="text-sm text-muted">עדיין לא שלחתם פניות.</p>
          ) : (
            <ul className="divide-y divide-border">
              {inquiries.map((i) => (
                <li key={i.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{i.supplier.companyName}</span>
                    <span className="text-muted">
                      {i.createdAt.toLocaleDateString("he-IL")} · {INQUIRY_STATUS_LABEL[i.status]}
                    </span>
                  </div>
                  <p className="text-muted">
                    הצעה של {shekels(i.totalAgorot)} לחודש{i.gapAgorot ? `, פער של ${shekels(i.gapAgorot)}` : ""}
                  </p>
                  {i.reply && (
                    <p className="rounded-md bg-background px-3 py-2">
                      <span className="text-muted">תשובת הספק: </span>
                      {i.reply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
