import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { createCategory, deleteCategory, renameCategory } from "../actions";

const ERRORS: Record<string, string> = {
  name: "נא למלא שם.",
  duplicate: "כבר יש סוג בשם הזה.",
  parent: "אפשר להוסיף תת-תחום רק תחת תחום ראשי.",
  "not-empty": "אפשר למחוק רק סוג ריק: בלי מוצרים, בלי תתי-תחומים ובלי ספקים שבחרו בו.",
};

const input =
  "min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-base outline-none focus:border-accent";

function Row({ id, name, count, sub }: { id: string; name: string; count: number; sub?: boolean }) {
  return (
    <li className={`flex flex-wrap items-center gap-2 py-2 ${sub ? "ps-6" : ""}`}>
      <form action={renameCategory} className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="categoryId" value={id} />
        <input
          name="name"
          defaultValue={name}
          aria-label={`שם הסוג ${name}`}
          className={`${input} ${sub ? "" : "font-medium"}`}
        />
        <button className="shrink-0 text-sm text-accent">שמירה</button>
      </form>
      <span className="shrink-0 text-xs text-muted">{count} מוצרים</span>
      <form action={deleteCategory}>
        <input type="hidden" name="categoryId" value={id} />
        <button className="text-sm text-muted hover:text-danger" aria-label={`מחיקת ${name}`}>
          מחיקה
        </button>
      </form>
    </li>
  );
}

export default async function AdminCategories({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireRole("ADMIN");
  const { error, saved } = await searchParams;
  const all = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  const roots = all.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">קטגוריות</h1>
        <p className="text-sm text-muted">
          תחומים ראשיים ותתי-תחומים. ספקים בוחרים בהם את התחומים שלהם, והסל של הלקוח מנותב לפיהם לספק המתאים.
        </p>
      </div>
      {error && ERRORS[error] && (
        <p role="alert" className="rounded-md bg-[#fbebeb] px-4 py-3 text-sm text-danger">
          {ERRORS[error]}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          נשמר.
        </p>
      )}

      <Card title="הוספת סוג">
        <form action={createCategory} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input name="name" placeholder="שם הסוג" aria-label="שם הסוג החדש" className={input} required />
          <select
            name="parentId"
            defaultValue=""
            aria-label="תחת תחום"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-base"
          >
            <option value="">תחום ראשי</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                תת-תחום של {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white">הוספה</button>
        </form>
      </Card>

      <section className="rounded-lg border border-border bg-surface p-4">
        <ul className="divide-y divide-border">
          {roots.map((c) => {
            const children = all.filter((x) => x.parentId === c.id);
            return (
              <li key={c.id}>
                <ul>
                  <Row
                    id={c.id}
                    name={c.name}
                    count={c._count.products + children.reduce((n, x) => n + x._count.products, 0)}
                  />
                  {children.map((x) => (
                    <Row key={x.id} id={x.id} name={x.name} count={x._count.products} sub />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
