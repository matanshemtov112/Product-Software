import Link from "next/link";
import { notFound } from "next/navigation";
import { Stars } from "@/components/stars";
import { requireRole } from "@/lib/auth/current";
import { supplierPriceList, suppliersInRegion } from "@/lib/customer/catalog";
import { findCompetitors } from "@/lib/customer/competitors";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { MIN_REVIEWS_FOR_RATING } from "@/lib/engine/load";
import { shekels, UNIT_LABEL } from "@/lib/format";

const domains = (s: { allCategories: boolean; categories: { category: { name: string } }[] }) =>
  s.allCategories ? "כל התחומים" : s.categories.map((c) => c.category.name).join(", ");

function pct(n: number) {
  const rounded = Math.round(Math.abs(n));
  if (rounded === 0) return "אותו מחיר בממוצע";
  return n < 0 ? `זול ב-${rounded}% בממוצע` : `יקר ב-${rounded}% בממוצע`;
}

export default async function Competitors({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const { supplier: supplierId } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const suppliers = await suppliersInRegion(customer.regionId);

  if (!supplierId) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">מתחרים לספק שלי</h1>
          <p className="text-sm text-muted">
            בחרו את הספק שאתם עובדים איתו היום, ונראה לכם אילו ספקים באזור {customer.region.name} מוכרים את אותם מוצרים ובכמה.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link
                href={`?supplier=${s.id}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-accent"
              >
                <span className="font-medium">{s.companyName}</span>
                <span className="text-sm text-muted">
                  {s._count.offers} מוצרים · {domains(s)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const current = suppliers.find((s) => s.id === supplierId);
  const mine = current && (await supplierPriceList(current.id));
  if (!current || !mine) notFound();
  const others = suppliers.filter((s) => s.id !== current.id);
  const [lists, ratings] = await Promise.all([
    Promise.all(others.map((s) => supplierPriceList(s.id))),
    db.review.groupBy({
      by: ["supplierId"],
      where: { status: "PUBLISHED", supplierId: { in: others.map((s) => s.id) } },
      _avg: { overall: true },
      _count: true,
    }),
  ]);
  const competitors = findCompetitors(mine, lists.filter((l) => l !== null));
  const info = new Map(others.map((s) => [s.id, s]));
  const rating = new Map(ratings.map((r) => [r.supplierId, r]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/competitors" className="text-sm text-muted hover:text-foreground">
          → בחירת ספק אחר
        </Link>
        <h1 className="text-2xl font-bold">מי מתחרה ב{current.companyName}?</h1>
        <p className="text-sm text-muted">
          {competitors.length
            ? `${competitors.length} ספקים באזור שלכם מוכרים חלק מהמוצרים שלו. המחירים הם במדרגה הבסיסית, ללא מע״מ; המחיר שלכם בפועל תלוי בהיקף הקנייה החודשי.`
            : "לא מצאנו ספק אחר באזור שלכם שמוכר את אותם מוצרים."}
        </p>
      </div>

      <div className="rounded-lg bg-accent-soft p-4 text-sm">
        <p>לחישוב מדויק לפי הכמויות וההיקף החודשי שלכם, כולל משלוח ומינימום הזמנה:</p>
        <Link
          href={`/customer/baskets/new?mode=supplier&supplier=${current.id}`}
          className="mt-2 inline-block rounded-md bg-accent px-4 py-2 font-medium text-white"
        >
          בניית סל מהמוצרים של {current.companyName}
        </Link>
      </div>

      <ol className="flex flex-col gap-3">
        {competitors.map((c, index) => {
          const s = info.get(c.supplierId)!;
          const r = rating.get(c.supplierId);
          const avg = r && r._count >= MIN_REVIEWS_FOR_RATING ? r._avg.overall : null;
          return (
            <li key={c.supplierId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {index + 1}. {c.supplierName}
                  </p>
                  <p className="text-xs text-muted">{domains(s)}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-sm">
                  <span className={c.avgDiffPct < 0 ? "font-semibold text-accent" : "text-muted"}>{pct(c.avgDiffPct)}</span>
                  {avg ? (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Stars value={avg} size={13} /> {avg.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">עוד אין מספיק דירוגים</span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm">
                מוכר {c.lines.length} מתוך {mine.items.filter((i) => i.priceAgorot != null).length} המוצרים של{" "}
                {current.companyName},{" "}
                {c.cheaperCount ? `וזול יותר ב-${c.cheaperCount} מהם.` : "אבל לא זול יותר באף אחד מהם."}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1 text-start font-normal">מוצר</th>
                      <th className="py-1 text-start font-normal">{current.companyName}</th>
                      <th className="py-1 text-start font-normal">{c.supplierName}</th>
                      <th className="py-1 text-start font-normal">הפרש</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {c.lines.map((l) => {
                      const diff = l.competitorAgorot - l.currentAgorot;
                      const unit = UNIT_LABEL[l.unit as keyof typeof UNIT_LABEL];
                      return (
                        <tr key={l.productId}>
                          <td className="py-1.5">{l.productName}</td>
                          <td className="py-1.5">
                            {shekels(l.currentAgorot, 2)} / {unit}
                          </td>
                          <td className="py-1.5">
                            {shekels(l.competitorAgorot, 2)} / {unit}
                          </td>
                          <td className={`py-1.5 ${diff < 0 ? "font-medium text-accent" : "text-muted"}`}>
                            <bdi dir="ltr">{diff === 0 ? "—" : `${diff < 0 ? "−" : "+"}${shekels(Math.abs(diff), 2)}`}</bdi>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
