import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { supplierForUser } from "@/lib/supplier/catalog";
import { ImportFlow } from "./import-flow";

export default async function PriceListImportPage() {
  const session = await requireRole("SUPPLIER");
  await requirePermission("prices", session.userId);
  const supplier = await supplierForUser(session.userId);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/supplier" className="text-sm text-accent hover:underline">
          → חזרה למוצרים
        </Link>
        <h1 className="mt-1 text-2xl font-bold">עדכון מחירון מאקסל</h1>
        <p className="text-sm text-muted">
          במקום לעדכן מוצר אחרי מוצר: מורידים את המחירון, משנים את המחירים באקסל, ומעלים בחזרה. לפני השמירה תראו בדיוק
          מה משתנה.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "הורידו את המחירון", "קובץ עם כל המוצרים והמחירים שלכם היום. נפתח באקסל."],
          ["2", "עדכנו מחירים באקסל", "שנו רק את עמודות המחיר ואת עמודת זמין. אל תשנו את עמודת המזהה."],
          ["3", "העלו ובדקו", "תראו רשימה של כל השינויים, ותבחרו מה לשמור."],
        ].map(([n, title, text]) => (
          <li key={n} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-ink-foreground">
              {n}
            </span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <ImportFlow multiTier={supplier.priceTiers.length > 1} />
    </div>
  );
}
