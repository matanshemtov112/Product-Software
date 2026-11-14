import { VerifiedBadge } from "@/components/verified-badge";
import { Card } from "@/components/form";
import { SaleMark } from "@/components/price-badge";
import { SendToSupplierLink } from "@/components/send-to-supplier";
import { requireRole } from "@/lib/auth/current";
import { customerDeals, type CustomerDeal } from "@/lib/customer/deals";
import { customerForUser } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";
import { lastValidDay, shortDate } from "@/lib/price-status";

function DealCard({ d }: { d: CustomerDeal }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p>
          <SaleMark />
          <span className="font-medium">{d.productName}</span>
          <span className="text-sm text-muted"> · {d.supplierName}</span>
          <VerifiedBadge supplierId={d.supplierId} compact />
        </p>
        <p className="text-xs text-muted">{d.pack}</p>
        {d.promotion && (
          <p className="text-sm">
            <strong className="text-danger">{shekels(d.promotion.priceAgorot, 2)}</strong> ל{d.unitLabel}
            {d.regularAgorot !== null && (
              <span className="ms-1 text-muted line-through">{shekels(d.regularAgorot, 2)}</span>
            )}
            {d.promotion.packPrice && <span className="text-muted"> · {d.promotion.packPrice}</span>}
            {d.promotion.validTo && (
              <span className="text-muted"> · עד {shortDate(lastValidDay(d.promotion.validTo))}</span>
            )}
          </p>
        )}
        {d.quantityDeal && (
          <p className="text-sm">
            <span className="rounded bg-[#fde7d9] px-1.5 py-0.5 text-xs text-[#7a3410]">{d.quantityDeal.label}</span>
            {!d.promotion && d.regularAgorot !== null && (
              <span className="ms-2 text-xs text-muted">
                מחיר רגיל {shekels(d.regularAgorot, 2)} ל{d.unitLabel}
              </span>
            )}
          </p>
        )}
      </div>
      <SendToSupplierLink href={`/customer/deals/${d.offerId}`} label="מעוניין במבצע" />
    </li>
  );
}

export default async function DealsPage() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const deals = await customerDeals(customer.id);
  const mine = deals.filter((d) => d.inMyBaskets);
  const others = deals.filter((d) => !d.inMyBaskets);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מבצעים</h1>
        <p className="text-sm text-muted">
          מבצעים שהספקים באזור שלכם פרסמו: מחיר מוזל עד תאריך, או הנחה מכמות מסוימת בהזמנה. ראיתם מבצע שמעניין אתכם?
          שלחו פנייה והספק יחזור אליכם. המחירים ללא מע״מ.
        </p>
      </div>
      {deals.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          אין כרגע מבצעים אצל ספקים שמספקים לאזור שלכם.
        </p>
      ) : (
        <>
          {mine.length > 0 && (
            <Card title="על מוצרים שאתם קונים">
              <ul className="flex flex-col gap-2">
                {mine.map((d) => (
                  <DealCard key={d.offerId} d={d} />
                ))}
              </ul>
            </Card>
          )}
          {others.length > 0 && (
            <Card title={mine.length ? "מבצעים נוספים" : "כל המבצעים"}>
              <ul className="flex flex-col gap-2">
                {others.map((d) => (
                  <DealCard key={d.offerId} d={d} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
