import { shekels, UNIT_LABEL } from "@/lib/format";
import type { PaidComparisonLine, SystemOffer } from "@/lib/customer/paid-prices";
import { DealBadge, PriceStatusBadge, SaleMark, WasPrice } from "./price-badge";

/** תובנה קצרה: בכמה הלקוח משלם יותר (או פחות) מהמחיר הזול ביותר שמצאנו */
export function gapInsight(gapPct: number | null) {
  if (gapPct === null) return "אין עדיין ספק במערכת שמוכר את המוצר באזור שלכם.";
  if (gapPct > 0) return `אתם משלמים כ-${gapPct.toLocaleString("he-IL")}% יותר מהמחיר הנמוך ביותר שמצאנו.`;
  if (gapPct === 0) return "אתם משלמים כמו המחיר הנמוך ביותר שמצאנו.";
  return `המחיר שלכם נמוך בכ-${Math.abs(gapPct).toLocaleString("he-IL")}% מהמחיר הנמוך ביותר שמצאנו.`;
}

/**
 * השוואה לפי מוצר: המחיר שהלקוח משלם, ההצעות במערכת מהזולה ליקרה עם סטטוס המחיר, ותובנה.
 * כל מוצר נפתח לרשימת הספקים המלאה.
 */
export function ProductComparison({
  lines,
  currentSupplierId,
}: {
  lines: PaidComparisonLine[];
  currentSupplierId?: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {lines.map((l) => {
        const unit = UNIT_LABEL[l.unit as keyof typeof UNIT_LABEL];
        return (
          <li key={l.productId}>
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-2 gap-x-4 gap-y-1 p-3 text-sm sm:grid-cols-[2fr_1fr_1.5fr_1fr] [&::-webkit-details-marker]:hidden">
                <span>
                  {l.offers.some((o) => o.priceKind === "PROMOTION" || o.deal) && <SaleMark />}
                  <span className="font-medium">{l.productName}</span>
                  <span className="block text-xs text-muted">
                    {l.quantity} {unit} בחודש · <span className="text-accent group-open:hidden">השוואה מלאה ▾</span>
                    <span className="hidden text-accent group-open:inline">סגירה ▴</span>
                  </span>
                </span>
                <span>
                  <span className="block text-xs text-muted">אתם משלמים</span>
                  <span className={l.monthlySavingAgorot > 0 ? "text-muted line-through" : ""}>
                    {shekels(l.paidAgorot, 2)} / {unit}
                  </span>
                </span>
                <span>
                  <span className="block text-xs text-muted">הכי זול במערכת</span>
                  {l.best ? (
                    <>
                      <WasPrice nowAgorot={l.best.unitPriceAgorot} regularAgorot={l.best.regularUnitAgorot} />
                      <span className={l.monthlySavingAgorot > 0 ? "font-medium text-accent" : ""}>
                        {shekels(l.best.unitPriceAgorot, 2)} / {unit}
                      </span>
                      <span className="block text-xs text-muted">
                        {l.best.supplierName}
                        {l.best.supplierId === currentSupplierId ? " (הספק שלכם)" : ""}
                      </span>
                      <OtherPacks offer={l.best} />
                      <span className="mt-0.5 block">
                        <PriceStatusBadge
                          kind={l.best.priceKind}
                          updatedAt={l.best.priceUpdatedAt}
                          validTo={l.best.priceValidTo}
                        />
                      </span>
                      {l.best.deal && (
                        <span className="mt-1 block">
                          <DealBadge deal={l.best.deal} unitLabel={unit} />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">אין ספק במערכת</span>
                  )}
                </span>
                <span>
                  <span className="block text-xs text-muted">הפרש מחיר בחודש</span>
                  {l.monthlySavingAgorot > 0 ? (
                    <span className="font-semibold text-accent">{shekels(l.monthlySavingAgorot)}</span>
                  ) : l.best ? (
                    <span className="text-muted">המחיר שלכם טוב יותר</span>
                  ) : (
                    "—"
                  )}
                </span>
              </summary>
              <div className="flex flex-col gap-2 bg-background px-3 pt-2 pb-3 text-sm">
                <p>{gapInsight(l.gapPct)}</p>
                {l.offers.length > 0 && (
                  <table className="w-full">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="pb-1 text-start font-normal">ספק</th>
                        <th className="pb-1 text-start font-normal">מחיר עבורכם</th>
                        <th className="pb-1 text-start font-normal">סוג המחיר</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.offers.map((o) => (
                        <tr key={o.supplierId} className="border-t border-border">
                          <td className="py-1.5">
                            {(o.priceKind === "PROMOTION" || o.deal) && <SaleMark />}
                            {o.supplierName}
                            {o.supplierId === currentSupplierId ? " (הספק שלכם)" : ""}
                            <OtherPacks offer={o} />
                          </td>
                          <td className="py-1.5">
                            <WasPrice nowAgorot={o.unitPriceAgorot} regularAgorot={o.regularUnitAgorot} />
                            {shekels(o.unitPriceAgorot, 2)} / {unit}
                          </td>
                          <td className="py-1.5">
                            <PriceStatusBadge
                              kind={o.priceKind}
                              updatedAt={o.priceUpdatedAt}
                              validTo={o.priceValidTo}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** האריזה שנבחרה, כשלספק יש כמה אריזות למוצר, והאריזות האחרות באפור מתחת */
function OtherPacks({ offer }: { offer: SystemOffer }) {
  if (!offer.otherPacks?.length) return null;
  return (
    <>
      {offer.packLabel && <span className="block text-xs text-muted">{offer.packLabel}</span>}
      {offer.otherPacks.map((t) => (
        <span key={t} className="block text-xs text-muted">
          {t}
        </span>
      ))}
    </>
  );
}
