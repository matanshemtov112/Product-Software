import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { searchItems } from "@/lib/search";

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pending?: string }>;
}) {
  await requireRole("ADMIN");
  const { q = "", pending } = await searchParams;
  const all = await db.product.findMany({
    where: pending ? { pendingReview: true } : {},
    include: { category: { include: { parent: true } }, _count: { select: { offers: true } } },
    orderBy: [{ pendingReview: "desc" }, { name: "asc" }],
  });
  const products = searchItems(all, q, (p) => ({
    name: p.name,
    aliases: p.aliases,
    categories: [p.category.name, p.category.parent?.name].filter((c): c is string => Boolean(c)),
  }));
  const waiting = all.filter((p) => p.pendingReview).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מוצרים ושמות נרדפים</h1>
        <p className="text-sm text-muted">
          הקטלוג שהלקוחות מחפשים בו. מוצר שספק הוסיף מסומן ״חדש״ ולא מוצג ללקוחות עד שבודקים אותו: שם, סוג, יחידה, ואם
          הוא כפול של מוצר קיים, ממזגים אותו. שמות נרדפים עוזרים ללקוחות למצוא מוצר גם בשם אחר.
        </p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש מוצר, שם נרדף או סוג"
          aria-label="חיפוש מוצר"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        {pending && <input type="hidden" name="pending" value="1" />}
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">חיפוש</button>
        <Link
          href={pending ? "/admin/products" : "/admin/products?pending=1"}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm"
        >
          {pending ? "כל המוצרים" : `רק חדשים לבדיקה${waiting ? ` (${waiting})` : ""}`}
        </Link>
      </form>
      <section className="rounded-lg border border-border bg-surface p-2">
        {products.length === 0 ? (
          <p className="p-3 text-sm text-muted">לא נמצאו מוצרים.</p>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="flex flex-col gap-1 rounded-md px-3 py-2 hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.pendingReview && (
                      <span className="ms-2 rounded bg-[#fff4c2] px-2 py-0.5 text-xs text-[#6b5500]">חדש לבדיקה</span>
                    )}
                    <p className="truncate text-xs text-muted">
                      {[p.category.parent?.name, p.category.name].filter(Boolean).join(" › ")} · {UNIT_LABEL[p.unit]}
                      {p.aliases.length > 0 && ` · גם: ${p.aliases.join(", ")}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{p._count.offers} ספקים</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
