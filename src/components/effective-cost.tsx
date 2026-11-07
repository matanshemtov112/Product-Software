import type { EffectiveCost } from "@/lib/customer/effective-cost";
import { shekels } from "@/lib/format";

/** פירוט העלות האפקטיבית: מוצרים + משלוח מול מה שמשלמים היום */
export function CostBreakdown({ cost }: { cost: EffectiveCost }) {
  return (
    <p className="text-xs text-muted">
      אתם משלמים היום {shekels(cost.paidAgorot)} על המוצרים האלה · אצלו {shekels(cost.productsAgorot)}
      {cost.deliveryAgorot > 0
        ? ` + משלוח ${shekels(cost.deliveryAgorot)}`
        : cost.alreadyOrdering
          ? " (בלי משלוח נוסף)"
          : " (משלוח חינם)"}{" "}
      = {shekels(cost.totalAgorot)} בחודש
    </p>
  );
}

/** ספק זול ליחידה שלא משתלם בפועל, ולמה */
export function BlockedList({
  items,
}: {
  items: {
    supplierId: string;
    supplierName: string;
    products: string[];
    cost: EffectiveCost;
    reason: string;
    currentShortfallPerOrderAgorot: number;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">זול יותר ליחידה, אבל לא משתלם כרגע</p>
      <ul className="flex flex-col gap-2">
        {items.map((b, i) => (
          <li key={`${b.supplierId}:${i}`} className="rounded-lg border border-dashed border-border p-3 text-sm">
            <p className="font-medium">{b.supplierName}</p>
            <p className="text-muted">
              {b.products.join(", ")}: זול יותר ב-{shekels(b.cost.productSavingAgorot)} בחודש לפי מחיר ליחידה.
            </p>
            <p>
              {b.reason === "min-order"
                ? `אבל מינימום ההזמנה שלו גבוה מההזמנה שלכם אצלו (${shekels(b.cost.perOrderAgorot)} בכל הזמנה). צריך להזמין ממנו עוד ${shekels(b.cost.shortfallPerOrderAgorot)} בכל הזמנה כדי שיהיה אפשר.`
                : b.reason === "delivery"
                  ? `אבל המשלוח (${shekels(b.cost.deliveryAgorot)} בחודש) מבטל את החיסכון.`
                  : `אבל אם תעבירו אותם, ההזמנה שתישאר אצל הספק הנוכחי שלכם תהיה מתחת למינימום שלו (חסרים ${shekels(b.currentShortfallPerOrderAgorot)} בכל הזמנה).`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
