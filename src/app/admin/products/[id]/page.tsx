import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Field, Input, Select } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { categoryTree } from "@/lib/categories";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { mergeProduct, updateProduct } from "../../actions";

const ERRORS: Record<string, string> = {
  name: "נא למלא שם למוצר.",
  unit: "יחידה לא תקינה.",
  duplicate: "כבר יש מוצר בשם הזה. אם זה אותו מוצר, מזגו אותו במקום לשנות שם.",
  category: "נא לבחור סוג.",
  target: "נא לבחור מוצר למיזוג.",
  "merge-unit": "אי אפשר למזג מוצרים עם יחידות שונות (למשל ק״ג ויחידה).",
};

const button = "rounded-md px-4 py-2 text-sm font-medium";

export default async function AdminProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; merged?: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { error, saved, merged } = await searchParams;
  const [product, tree, others] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        offers: { include: { supplier: { select: { companyName: true } } } },
        _count: { select: { basketItems: true } },
      },
    }),
    categoryTree(),
    db.product.findMany({
      where: { id: { not: id } },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!product) notFound();
  const sameUnit = others.filter((o) => o.unit === product.unit);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
          → כל המוצרים
        </Link>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="text-sm text-muted">
          {product.offers.length} ספקים · מופיע ב-{product._count.basketItems} סלים
          {product.pendingReview && " · חדש, עדיין לא מוצג ללקוחות"}
        </p>
      </div>

      {error && ERRORS[error] && (
        <p role="alert" className="rounded-md bg-[#fbebeb] px-4 py-3 text-sm text-danger">
          {ERRORS[error]}
        </p>
      )}
      {(saved || merged) && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          {merged ? "המוצרים מוזגו. השם הכפול נשמר כשם נרדף." : "המוצר נשמר ומוצג ללקוחות."}
        </p>
      )}

      <Card title="פרטי המוצר">
        <form action={updateProduct} className="flex flex-col gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <Field label="שם המוצר">
            <Input name="name" defaultValue={product.name} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="סוג">
              <Select name="categoryId" defaultValue={product.categoryId}>
                {tree.map((c) =>
                  c.children.length ? (
                    <optgroup key={c.id} label={c.name}>
                      {c.children.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="יחידה">
              <Select name="unit" defaultValue={product.unit}>
                {Object.entries(UNIT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="מפרט (לא חובה)">
            <Input name="spec" defaultValue={product.spec ?? ""} placeholder="למשל: תבנית 30" />
          </Field>
          <Field label="שמות נרדפים, מופרדים בפסיק">
            <textarea
              name="aliases"
              rows={2}
              defaultValue={product.aliases.join(", ")}
              placeholder="למשל: שמן לפתית, קנולה"
              className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </Field>
          <div>
            <button className={`${button} bg-accent text-white`}>
              {product.pendingReview ? "שמירה ואישור המוצר" : "שמירה"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="השמות אצל הספקים">
        {product.offers.length === 0 ? (
          <p className="text-sm text-muted">אף ספק לא מוכר את המוצר.</p>
        ) : (
          <ul className="text-sm">
            {product.offers.map((o) => (
              <li key={o.id} className="py-1">
                {o.supplier.companyName}: {o.supplierProductName ?? <span className="text-muted">אותו שם</span>}
                {o.brand && <span className="text-muted"> · {o.brand}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="מיזוג לתוך מוצר אחר">
        <p className="mb-3 text-sm text-muted">
          אם זה אותו מוצר כמו מוצר קיים (למשל ספק הוסיף ״עגבניה״ כשיש ״עגבניות״), מזגו אותו. הספקים והסלים עוברים למוצר
          הקיים, והשם הזה נשמר שם כשם נרדף. אי אפשר לבטל מיזוג.
        </p>
        <form action={mergeProduct} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="productId" value={product.id} />
          <Field label="המוצר הקיים">
            <Select name="targetId" defaultValue="">
              <option value="" disabled>
                בחירת מוצר
              </option>
              {sameUnit.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <button className={`${button} border border-border bg-surface`}>מיזוג</button>
        </form>
      </Card>
    </div>
  );
}
