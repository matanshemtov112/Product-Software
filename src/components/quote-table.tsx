import { shekels } from "@/lib/format";
import type { QuoteSnapshot } from "@/lib/inquiries";
import { UNIT_LABEL } from "@/lib/supplier/catalog";

/** טבלת ההצעה שהלקוח קיבל מהמערכת לספק אחד */
export function QuoteTable({ quote }: { quote: QuoteSnapshot }) {
  const showPaid = quote.lines.some((l) => l.customerPaidAgorot != null);
  const cols = showPaid ? 4 : 3;
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="text-muted">
            <tr>
              <th className="pb-2 text-start font-normal">מוצר</th>
              <th className="pb-2 text-start font-normal">כמות בחודש</th>
              <th className="pb-2 text-start font-normal">מחיר ליחידה</th>
              {showPaid && <th className="pb-2 text-start font-normal">הלקוח משלם היום</th>}
              <th className="pb-2 text-start font-normal">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l) => (
              <tr key={l.productName} className="border-t border-border">
                <td className="py-2">{l.productName}</td>
                <td className="py-2">
                  {l.billedQuantity} {UNIT_LABEL[l.unit]}
                  {l.billedQuantity !== l.quantity && (
                    <span className="block text-xs text-muted">ביקוש {l.quantity}, מעוגל לאריזות</span>
                  )}
                </td>
                <td className="py-2">{shekels(l.unitPriceAgorot, 2)}</td>
                {showPaid && (
                  <td className="py-2">
                    {l.customerPaidAgorot != null ? (
                      <span className={l.customerPaidAgorot < l.unitPriceAgorot ? "font-medium text-accent" : ""}>
                        {shekels(l.customerPaidAgorot, 2)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                )}
                <td className="py-2">{shekels(l.lineTotalAgorot)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="pt-2 text-muted" colSpan={cols}>
                משלוחים
              </td>
              <td className="pt-2">{quote.deliveryAgorot ? shekels(quote.deliveryAgorot) : "חינם"}</td>
            </tr>
            <tr>
              <td className="pt-1 font-semibold" colSpan={cols}>
                סה״כ לחודש, ללא מע״מ
              </td>
              <td className="pt-1 font-semibold">{shekels(quote.totalAgorot)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted">
        מדרגת מחיר: {quote.tierName}
        {showPaid && " · מחיר בירוק: הלקוח משלם היום פחות מהמחירון"}
        {quote.missingProducts.length > 0 && ` · לא כלול (הספק לא מוכר): ${quote.missingProducts.join(", ")}`}
      </p>
    </div>
  );
}
