import Link from "next/link";
import { db } from "@/lib/db";
import { activeViolationsWhere } from "@/lib/price-violations-sync";
import { STAGE_MESSAGE } from "@/lib/price-violations";

/**
 * מה הספק רואה מהשלב השני: כמה דיווחים, ועל אילו מוצרים, בלי שמות הלקוחות שדיווחו.
 */
export async function ViolationNotice({ supplierId, stage }: { supplierId: string; stage: number }) {
  if (stage < 2) return null;
  const reports = await db.priceViolationReport.findMany({
    where: activeViolationsWhere(supplierId),
    select: { productName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const byProduct = new Map<string, number>();
  for (const r of reports) byProduct.set(r.productName, (byProduct.get(r.productName) ?? 0) + 1);
  const products = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  const message = STAGE_MESSAGE[Math.min(stage, 4) as 2 | 3 | 4];

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-danger bg-[#fde2e1] px-4 py-3 text-sm">
      <p className="font-semibold text-danger">{message.title}</p>
      <p>
        ב-90 הימים האחרונים התקבלו {reports.length} דיווחים מלקוחות שהמחיר שנגבה מהם היה גבוה מהמחיר שמופיע אצלכם
        במערכת. בדקו את המוצרים האלה, ועדכנו מחיר שהשתנה:
      </p>
      <ul className="flex flex-wrap gap-2">
        {products.map(([name, count]) => (
          <li key={name} className="rounded bg-surface px-2 py-0.5">
            {name} · {count} דיווחים
          </li>
        ))}
      </ul>
      <Link href="/supplier/products" className="self-start font-medium text-accent underline">
        לרשימת המוצרים
      </Link>
    </div>
  );
}
