import { VerifiedBadge } from "@/components/verified-badge";
import type { BrandChoice } from "@/lib/customer/quotes";
import { shekels, UNIT_LABEL } from "@/lib/format";

/**
 * מוצרים שהלקוח ביקש במותג מסוים: קודם המחיר הזול לאותו מותג בדיוק,
 * ומתחת מוצר דומה ממותג אחר אם הוא זול יותר, עם החיסכון בחודש.
 */
export function BrandChoices({ choices }: { choices: BrandChoice[] }) {
  if (choices.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {choices.map((c) => {
        const unit = UNIT_LABEL[c.unit];
        return (
          <li key={c.productId} className="flex flex-col gap-2 p-3 text-sm">
            <p>
              <span className="font-medium">{c.productName}</span>
              <span className="text-muted">
                {" "}
                · ביקשתם מותג {c.brand} · {c.quantity} {unit} בחודש
              </span>
            </p>
            {c.exact ? (
              <p>
                <span className="block text-xs text-muted">{c.brand}, המחיר הכי זול במערכת</span>
                <span className="font-medium">
                  {shekels(c.exact.unitPriceAgorot, 2)} / {unit}
                </span>{" "}
                <span className="text-muted">
                  אצל {c.exact.supplierName}
                  <VerifiedBadge supplierId={c.exact.supplierId} compact />
                </span>
              </p>
            ) : (
              <p className="text-muted">אף ספק באזור שלכם לא מוכר כרגע את {c.brand}.</p>
            )}
            {c.similar && (
              <p className="rounded-md bg-accent-soft px-3 py-2">
                <span className="block text-xs text-muted">
                  {c.exact ? "מוצר דומה זול יותר" : "מוצר דומה שיש במערכת"}
                </span>
                {c.productName} {c.similar.brand ? `של ${c.similar.brand}` : "(מותג לא צוין)"} ב-
                <span className="font-medium">
                  {shekels(c.similar.unitPriceAgorot, 2)} / {unit}
                </span>{" "}
                <span className="text-muted">
                  אצל {c.similar.supplierName}
                  <VerifiedBadge supplierId={c.similar.supplierId} compact />
                </span>
                {c.similarSavingAgorot !== null && c.similarSavingAgorot > 0 && (
                  <span className="block font-medium text-accent">
                    חיסכון של {shekels(c.similarSavingAgorot)} בחודש אם תעברו למותג אחר
                  </span>
                )}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** המותג ליד המחיר, כשהספק ציין אותו */
export function BrandTag({ brand }: { brand?: string | null }) {
  if (!brand) return null;
  return <span className="text-muted"> · {brand}</span>;
}
