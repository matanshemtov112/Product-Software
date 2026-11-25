import { isDealSnapshot } from "./deals";

/**
 * לאן הולכים כדי לשלוח לספק פנייה חדשה במקום פנייה שהסתיימה, או כדי לבדוק מחדש את המחירים:
 * לסל שממנו נשלחה, למבצע, או לדף הספק (בבקשת השוואה). basketIds: הסלים שעוד קיימים.
 */
export function newInquiryHref(
  o:
    | { kind: "inquiry"; supplierId: string; basketId: string | null; deal: unknown }
    | { kind: "match"; supplierName: string },
  basketIds: Set<string>,
): string {
  if (o.kind === "match") return `/customer/suppliers/${encodeURIComponent(o.supplierName)}`;
  if (isDealSnapshot(o.deal)) return o.deal.offerId ? `/customer/deals/${o.deal.offerId}` : "/customer/deals";
  if (o.basketId && basketIds.has(o.basketId)) return `/customer/baskets/${o.basketId}/inquiry/${o.supplierId}`;
  return "/customer";
}

/** לאן הולכים כדי לראות את המחירים של היום, אחרי שההצעה מהמערכת פגה */
export function recheckHref(
  o: { supplierId: string; basketId: string | null; deal: unknown },
  basketIds: Set<string>,
): string {
  if (isDealSnapshot(o.deal)) return o.deal.offerId ? `/customer/deals/${o.deal.offerId}` : "/customer/deals";
  if (o.basketId && basketIds.has(o.basketId)) return `/customer/baskets/${o.basketId}`;
  return "/customer";
}
