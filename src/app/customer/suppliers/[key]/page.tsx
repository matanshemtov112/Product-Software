import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { ProductComparison } from "@/components/product-comparison";
import { SendToSupplierLink } from "@/components/send-to-supplier";
import { SupplierStatusBadge } from "@/components/supplier-status";
import { requireRole } from "@/lib/auth/current";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { MATCH_STATUS_LABEL, matchCandidates } from "@/lib/matches";

export default async function MySupplierPage({ params }: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await params).key);
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const supplier = (await mySuppliers(customer.id)).find((s) => s.key === key);
  if (!supplier) notFound();
  const { score } = supplier;
  const candidates = matchCandidates(supplier.lines);
  const requests = supplier.supplierId
    ? await db.matchRequest.findMany({
        where: { customerId: customer.id, supplierId: supplier.supplierId },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/suppliers" className="text-sm text-muted hover:text-foreground">
          → כל הספקים שלי
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <SupplierStatusBadge status={score.status} />
        </div>
        <p className="text-sm text-muted">
          {score.products} מוצרים מהסלים:{" "}
          {supplier.baskets.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ", "}
              <Link href={`/customer/baskets/${b.id}`} className="text-accent">
                {b.name}
              </Link>
            </span>
          ))}
        </p>
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">רוצים להישאר עם {supplier.name}?</p>
            <p className="text-sm">
              בקשו ממנו להשוות את המחיר ב-{candidates.length} מוצרים שמצאנו זולים יותר, וחסכו בלי להחליף ספק.
            </p>
            {requests.length > 0 && (
              <p className="mt-1 text-sm">
                {requests.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && " · "}
                    <Link href={`/customer/matches/${r.id}`} className="text-accent">
                      בקשה מ-{r.createdAt.toLocaleDateString("he-IL")}: {MATCH_STATUS_LABEL[r.status]}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
          <Link
            href={`/customer/suppliers/${encodeURIComponent(supplier.key)}/match`}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-center text-sm font-medium whitespace-nowrap text-white"
          >
            בקשו מהספק להשוות
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card title="ציון תחרותיות">
          <p className="text-4xl font-bold">
            {score.score}
            <span className="text-lg font-normal text-muted">/100</span>
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-1 ps-5 text-sm">
            {score.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            הציון הוא הערכה לפי המחירים שמילאתם מול ההצעות במערכת, ולא קביעה על הספק.
          </p>
        </Card>
        <Card title="הזדמנויות לחיסכון">
          {supplier.opportunities.length === 0 ? (
            <p className="text-sm text-muted">
              לא מצאנו כרגע ספק במערכת שמוכר זול יותר את המוצרים שאתם קונים אצל {supplier.name}.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                חיסכון של עד <strong className="text-accent">{shekels(score.monthlySavingAgorot)}</strong> בחודש (
                {shekels(score.monthlySavingAgorot * 12)} בשנה), לפי מחיר ליחידה ולפני משלוח.
              </p>
              <ul className="flex flex-col gap-2">
                {supplier.opportunities.map((o) => (
                  <li
                    key={o.supplierId}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{o.supplierName}</p>
                      <p className="text-sm text-muted">
                        חיסכון של {shekels(o.monthlySavingAgorot)} בחודש על {o.products.join(", ")}
                      </p>
                    </div>
                    <SendToSupplierLink href={`/customer/baskets/${o.basketId}/inquiry/${o.supplierId}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="המוצרים והמחירים">
        <ProductComparison lines={supplier.lines} currentSupplierId={supplier.supplierId} />
        <p className="mt-2 text-xs text-muted">
          לחצו על מוצר כדי לראות את כל הספקים במערכת. מחיר מאומת: הספק עדכן אותו ב-30 הימים האחרונים. מחיר מחירון: פורסם
          קודם ועלול להשתנות.
        </p>
      </Card>
    </div>
  );
}
