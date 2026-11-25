import { VerifiedBadge } from "@/components/verified-badge";
import { minOrderText, supplierFacts, validityText } from "@/lib/customer/offer-facts";
import { shekels } from "@/lib/format";
import { getSession } from "@/lib/auth/current";
import { deliveryFrequencyFor } from "@/lib/coverage";
import { customerForUser } from "@/lib/customer/quotes";
import { deliveryFrequencyText } from "@/lib/terms";

/** כמה פעמים בשבוע הספק מגיע ללקוח המחובר, במילים */
async function frequencyFor(supplierId: string) {
  const session = await getSession();
  if (session?.role !== "CUSTOMER") return null;
  const customer = await customerForUser(session.userId);
  return deliveryFrequencyText(await deliveryFrequencyFor(supplierId, customer));
}

/**
 * הפרטים שמופיעים אחרי כל הצעה של המערכת: מחיר כולל, האם הספק מאומת, מינימום הזמנה,
 * עד מתי ההצעה בתוקף, כמה פעמים בשבוע הספק מגיע, הכשרות ובאיזה אזור הוא עובד.
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
  const [facts, frequency] = await Promise.all([supplierFacts(supplierId), frequencyFor(supplierId)]);
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
        <dt className="text-muted">מגיע אליכם</dt>
        <dd>{frequency ?? "הספק עוד לא ציין ימי חלוקה"}</dd>
        <dt className="text-muted">כשרות</dt>
        <dd>
          {facts?.kosherText ?? "הספק לא סימן כשרות"}
          {facts?.kosherMixed ? " (לחלק מהמוצרים כשרות אחרת)" : ""}
        </dd>
        <dt className="text-muted">אזור עבודה</dt>
        <dd>{facts?.areaText ?? "—"}</dd>
      </dl>
    </div>
  );
}
