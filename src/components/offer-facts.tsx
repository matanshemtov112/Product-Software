import { VerifiedBadge } from "@/components/verified-badge";
import { minOrderText, supplierFacts, validityText } from "@/lib/customer/offer-facts";
import { shekels } from "@/lib/format";

/**
 * הפרטים שמופיעים אחרי כל הצעה של המערכת: מחיר כולל, האם הספק מאומת, מינימום הזמנה,
 * עד מתי ההצעה בתוקף ובאיזה אזור הספק עובד.
 */
export async function OfferFacts({
  supplierId,
  supplierName,
  totalAgorot,
  lines,
}: {
  supplierId: string;
  supplierName?: string;
  totalAgorot: number;
  lines: { priceKind?: string; priceValidTo?: string | null }[];
}) {
  const facts = await supplierFacts(supplierId);
  return (
    <div className="rounded-md border border-border bg-background p-2 text-xs">
      {supplierName && <p className="mb-1 text-sm font-medium text-foreground">{supplierName}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">מחיר כולל</dt>
        <dd className="font-medium">{shekels(totalAgorot)} לחודש, ללא מע״מ</dd>
        <dt className="text-muted">אימות</dt>
        <dd>
          <VerifiedBadge supplierId={supplierId} />
        </dd>
        <dt className="text-muted">מינימום הזמנה</dt>
        <dd>{facts ? minOrderText(facts.minOrderAgorot) : "—"}</dd>
        <dt className="text-muted">תוקף ההצעה</dt>
        <dd>{validityText(lines)}</dd>
        <dt className="text-muted">אזור עבודה</dt>
        <dd>{facts?.areaText ?? "—"}</dd>
      </dl>
    </div>
  );
}
