import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";

const date = (d: Date) => d.toLocaleDateString("he-IL");

export default async function CustomerHome() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const baskets = await db.basket.findMany({
    where: { customerId: customer.id },
    include: {
      _count: { select: { items: true } },
      currentSupplier: { select: { companyName: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ savedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  // לקוח חדש מתחיל ישר בבניית סל
  if (baskets.length === 0) redirect("/customer/baskets/new");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">הבדיקות שלי</h1>
          <p className="text-sm text-muted">סלים שבדקתם. סל שמור אפשר לבדוק שוב כל חודש ולראות מה השתנה.</p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {baskets.map((b) => (
          <li key={b.id}>
            <Link
              href={`/customer/baskets/${b.id}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-accent"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{b.name}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${b.savedAt ? "bg-accent-soft text-accent" : "bg-background text-muted"}`}>
                  {b.savedAt ? "שמור" : "לא נשמר"}
                </span>
              </span>
              <span className="text-sm text-muted">
                {b._count.items} מוצרים
                {b.currentSupplier ? ` · ספק נוכחי: ${b.currentSupplier.companyName}` : ""}
              </span>
              <span className="text-sm text-muted">
                {b.runs[0]
                  ? `בדיקה אחרונה ${date(b.runs[0].createdAt)}: הכי זול ${shekels(b.runs[0].bestCostAgorot)}`
                  : `נוצר ${date(b.createdAt)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
