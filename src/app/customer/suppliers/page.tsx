import Link from "next/link";
import { SupplierStatusBadge } from "@/components/supplier-status";
import { requireRole } from "@/lib/auth/current";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerForUser } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";

export default async function MySuppliersPage() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const suppliers = await mySuppliers(customer.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">הספקים שלי</h1>
        <p className="text-sm text-muted">
          הספקים שאתם עובדים איתם היום, לפי המחירים שמילאתם או שקראנו מהחשבוניות, מול ההצעות במערכת. המחירים ללא מע״מ.
        </p>
      </div>
      {suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted">
          <p>עוד אין לנו ספקים שלכם להשוות.</p>
          <p className="mt-1">
            <Link href="/customer/invoices/new" className="text-accent">
              העלו חשבונית
            </Link>{" "}
            או{" "}
            <Link href="/customer/baskets/new?mode=manual" className="text-accent">
              בנו סל
            </Link>{" "}
            עם שם הספק והמחירים שאתם משלמים לו היום.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {suppliers.map((s) => (
            <li key={s.key}>
              <Link
                href={`/customer/suppliers/${encodeURIComponent(s.key)}`}
                className="grid grid-cols-2 items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-accent sm:grid-cols-[2fr_1fr_1fr_1.2fr]"
              >
                <span className="col-span-2 sm:col-span-1">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-xs text-muted">
                    {s.score.products} מוצרים{s.supplierId ? "" : " · לא רשום במערכת"}
                  </span>
                </span>
                <span>
                  <SupplierStatusBadge status={s.score.status} />
                </span>
                <span className="text-sm">
                  <span className="block text-xs text-muted">ציון תחרותיות</span>
                  {s.score.score}/100
                </span>
                <span className="text-sm">
                  <span className="block text-xs text-muted">חיסכון אפשרי בחודש</span>
                  {s.score.monthlySavingAgorot > 0 ? (
                    <span className="font-semibold text-accent">{shekels(s.score.monthlySavingAgorot)}</span>
                  ) : (
                    <span className="text-muted">אין כרגע</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {suppliers.length > 0 && (
        <p className="text-xs text-muted">
          🟢 תחרותי: עד 3% מעל המחיר הנמוך במערכת בממוצע · 🟡 כדאי לבדוק: עד 10% · 🔴 יקר יחסית: יותר מ-10%. הציון הוא
          הערכה לפי המחירים שמילאתם, ולא קביעה על הספק.
        </p>
      )}
    </div>
  );
}
