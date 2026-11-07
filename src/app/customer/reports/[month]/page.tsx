import Link from "next/link";
import { notFound } from "next/navigation";
import { CostBreakdown } from "@/components/effective-cost";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { reportMonth, reportMonths, type PriceMove } from "@/lib/customer/monthly-report";
import { loadMonthlyReport } from "@/lib/customer/monthly-report-load";
import { customerForUser } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";

function Stat({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? "bg-accent-soft" : "border border-border bg-surface"}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-accent" : ""}`}>{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

const pct = (before: number, after: number) => `${Math.abs(Math.round(((after - before) / before) * 1000) / 10)}%`;

function Moves({ moves, empty, showSupplier }: { moves: PriceMove[]; empty: string; showSupplier?: boolean }) {
  if (moves.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {moves.map((m) => {
        const up = m.afterAgorot > m.beforeAgorot;
        return (
          <li
            key={`${m.productName}:${m.supplierName}`}
            className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between"
          >
            <div className="min-w-0">
              <span className="font-medium">{m.productName}</span>
              {showSupplier && m.supplierName && <span className="text-sm text-muted"> · {m.supplierName}</span>}
              <p className="text-sm text-muted">
                מ-{shekels(m.beforeAgorot, 2)} ל-{shekels(m.afterAgorot, 2)} ל{m.unitLabel}, {up ? "עלייה" : "ירידה"} של{" "}
                {pct(m.beforeAgorot, m.afterAgorot)}
              </p>
            </div>
            <p className={`shrink-0 text-sm font-medium ${up ? "text-danger" : "text-accent"}`}>
              {up ? "+" : "−"}
              {shekels(Math.abs(m.monthlyImpactAgorot))} בחודש
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export default async function MonthlyReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: key } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const months = reportMonths(customer.createdAt);
  const month = reportMonth(key);
  if (!month || !months.some((m) => m.key === month.key)) notFound();
  const r = await loadMonthlyReport(customer.id, month);
  const priceImpact = [...r.increases, ...r.decreases].reduce((s, m) => s + m.monthlyImpactAgorot, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">הדוח החודשי: {month.label}</h1>
        <p className="text-sm text-muted">
          {month.partial ? "החודש עוד לא נגמר, אז הדוח מתעדכן עד היום. " : ""}
          מה בדקנו בשבילכם, מה השתנה במחירים וכמה אפשר לחסוך. המחירים לפי המחירון הבסיסי של כל ספק, ללא מע״מ.
        </p>
      </div>

      {months.length > 1 && (
        <nav aria-label="חודשים" className="flex flex-wrap gap-2">
          {months.map((m) => (
            <Link
              key={m.key}
              href={`/customer/reports/${m.key}`}
              aria-current={m.key === month.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                m.key === month.key ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="מוצרים שבדקנו"
          value={String(r.productsChecked)}
          note={`מול ${r.suppliersCompared} ספקים שמספקים לאזור שלכם`}
        />
        <Stat
          label="שינויי מחיר אצל הספקים שלכם"
          value={String(r.increases.length + r.decreases.length)}
          note={
            r.increases.length + r.decreases.length === 0
              ? "המחירים לא השתנו"
              : `${r.increases.length} עליות · ${r.decreases.length} ירידות · ${priceImpact >= 0 ? "+" : "−"}${shekels(Math.abs(priceImpact))} בחודש`
          }
        />
        <Stat
          label="אפשר לחסוך"
          value={shekels(r.potentialSavingAgorot)}
          note={`בחודש, כולל משלוח, ב-${r.opportunities.reduce((n, o) => n + o.products.length, 0)} מוצרים`}
        />
        <Stat
          label="חסכתם בפועל"
          value={shekels(r.actualSavingAgorot)}
          note={`בחודש, ממחירים שאישרתם (${shekels(r.actualSavingAgorot * 12)} בשנה)`}
          highlight
        />
      </div>

      <Card title="מחירים שעלו אצל הספקים שלכם">
        <Moves moves={r.increases} showSupplier empty="אף ספק שאתם עובדים איתו לא העלה מחיר החודש." />
      </Card>

      <Card title="מחירים שירדו אצל הספקים שלכם">
        <Moves moves={r.decreases} showSupplier empty="אף ספק שאתם עובדים איתו לא הוריד מחיר החודש." />
      </Card>

      <Card title="איפה אפשר לחסוך">
        {r.opportunities.length === 0 ? (
          <p className="text-sm text-muted">
            לא מצאנו ספק שיוצא זול ממה שאתם משלמים, כולל משלוח ומינימום הזמנה. כדי שנוכל להשוות, מלאו בסל את המחיר שאתם
            משלמים היום לכל מוצר.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {r.opportunities.map((o) => (
                <li key={o.supplierName} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                  <div className="min-w-0">
                    <span className="font-medium">{o.supplierName}</span>
                    {o.products.map((p) => (
                      <p key={p.productName} className="text-sm text-muted">
                        {p.productName}: משלמים {shekels(p.paidAgorot, 2)}, אצלו {shekels(p.bestAgorot, 2)} ל
                        {p.unitLabel}
                      </p>
                    ))}
                    <CostBreakdown cost={o.cost} />
                  </div>
                  <p className="shrink-0 text-sm font-medium text-accent">{shekels(o.monthlySavingAgorot)} בחודש</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link href="/customer/suppliers" className="text-accent">
                להספקים שלי
              </Link>{" "}
              כדי לפנות לספק הזול, או לבקש מהספק שלכם להשוות.
            </p>
          </>
        )}
      </Card>

      <Card title="חיסכון שאישרתם">
        {r.accepted.length === 0 ? (
          <p className="text-sm text-muted">
            החודש לא אישרתם מחיר חדש. כשספק משווה מחיר בעקבות בקשה שלכם ואתם מאשרים, החיסכון יופיע כאן.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {r.accepted.map((l, i) => (
              <li key={i} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <span className="font-medium">{l.productName}</span>
                  <span className="text-sm text-muted"> · {l.supplierName}</span>
                  <p className="text-sm text-muted">
                    מ-{shekels(l.beforeAgorot, 2)} ל-{shekels(l.afterAgorot, 2)} ל{l.unitLabel} · אושר{" "}
                    {l.decidedAt.toLocaleDateString("he-IL")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium text-accent">
                  {shekels(Math.max(0, Math.round((l.beforeAgorot - l.afterAgorot) * l.monthlyQuantity)))} בחודש
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="המחיר הזול בשוק">
        <p className="mb-2 text-sm text-muted">המחיר הזול ביותר שמצאנו לכל מוצר שלכם, בתחילת החודש ובסופו.</p>
        <Moves moves={r.marketMoves} showSupplier empty="המחיר הזול בשוק למוצרים שלכם לא השתנה החודש." />
      </Card>

      <p className="text-xs text-muted">
        החודש הרצתם {count(r.checks, "בדיקת סל אחת", "בדיקות סל")} וקיבלתם {count(r.alerts, "התראה אחת", "התראות")} על
        מחירים. החיסכון מחושב לפי הכמויות החודשיות בסל. ב״איפה אפשר לחסוך״ הוא כולל משלוח ומינימום הזמנה של כל ספק.
      </p>
    </div>
  );
}
