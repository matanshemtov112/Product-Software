import { Card } from "@/components/form";
import { SendToSupplierLink } from "@/components/send-to-supplier";
import { VerifiedBadge } from "@/components/verified-badge";
import type { SplitAdvice } from "@/lib/customer/split-advice";
import { shekels } from "@/lib/format";

/**
 * כשאין ספק אחד לכל הסל: אצל כל ספק קרוב, איזה מוצר חסר ומאיפה אפשר לקנות אותו בנפרד.
 */
export function SplitAdviceCard({
  advice,
  basketId,
  unitOf,
}: {
  advice: SplitAdvice;
  basketId: string;
  unitOf: (productId: string) => string;
}) {
  return (
    <Card id="split" title="אין ספק אחד שמוכר את כל הסל">
      <div className="flex flex-col gap-4 text-sm">
        {advice.candidates.length > 0 && (
          <p className="text-muted">
            בגלל זה ההמלצה מחלקת את הסל בין כמה ספקים. אם נוח לכם יותר לעבוד עם ספק אחד, אלה הספקים שהכי קרובים לכסות את
            הסל, ומה צריך לקנות בנפרד אצל כל אחד מהם.
          </p>
        )}
        {advice.candidates.map((c) => (
          <div key={c.supplierId} className="rounded-lg border border-border p-3">
            <p className="font-medium">
              {c.supplierName}
              <VerifiedBadge supplierId={c.supplierId} />
            </p>
            <p className="text-muted">
              מוכר {c.coveredCount} מתוך {advice.itemCount} המוצרים, {shekels(c.totalAgorot)} לחודש עליהם.
            </p>
            {c.belowMinimum && (
              <p className="mt-1 rounded-md bg-background px-3 py-2 text-xs">
                שימו לב: גם עם כל מה שהוא מוכר מהסל, ההזמנה לכל אספקה קטנה מהמינימום שלו ({shekels(c.minOrderAgorot)}).
                אפשר להגדיל כמויות או לעשות פחות אספקות בחודש{" "}
                <a href={`/customer/baskets/${basketId}/edit`} className="text-accent hover:underline">
                  בעריכת הסל
                </a>
                .
              </p>
            )}
            <p className="mt-2">
              <span className="font-medium text-danger">
                {c.missing.length === 1 ? "המוצר שחסר אצלו:" : `${c.missing.length} מוצרים חסרים אצלו:`}
              </span>
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {c.missing.map((m) => (
                <li key={m.productId}>
                  · <span className="font-medium">{m.name}</span>
                  {m.from ? (
                    <span className="text-muted">
                      {" "}
                      אפשר לקנות בנפרד אצל {m.from.supplierName} ב-{shekels(m.from.unitPriceAgorot, 2)} ל
                      {unitOf(m.productId)}
                    </span>
                  ) : (
                    <span className="text-muted"> אף ספק אחר באזור לא מוכר אותו</span>
                  )}
                </li>
              ))}
            </ul>
            {c.separate
              .filter((s) => s.belowMinimum)
              .map((s) => (
                <p key={s.supplierId} className="mt-2 rounded-md bg-background px-3 py-2 text-xs">
                  שימו לב: הזמנה נפרדת של {s.products.join(", ")} מ{s.supplierName} תהיה בערך{" "}
                  {shekels(s.perDeliveryAgorot)} לאספקה, פחות מהמינימום שלו ({shekels(s.minOrderAgorot)}). כדאי לשאול
                  אותו אם יסכים, או לבדוק אם {c.supplierName} יכול להשיג את המוצר.
                </p>
              ))}
            {!c.belowMinimum && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <SendToSupplierLink href={`/customer/baskets/${basketId}/inquiry/${c.supplierId}`} />
                <span className="text-xs text-muted">בהודעה אפשר לשאול אם יוכל לספק גם את המוצרים החסרים.</span>
              </div>
            )}
          </div>
        ))}
        {advice.nobodySells.length > 0 && (
          <p className="rounded-md bg-background px-3 py-2">
            <span className="font-medium">אף ספק באזור שלכם לא מוכר כרגע:</span> {advice.nobodySells.join(", ")}. את
            המוצרים האלה תצטרכו להמשיך לקנות מחוץ למערכת. נעדכן אתכם כשיצטרף ספק שמוכר אותם.
          </p>
        )}
      </div>
    </Card>
  );
}
