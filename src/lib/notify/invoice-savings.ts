import { analyzeBasket, getBasket, paidComparison } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";
import { notify } from "@/lib/notifications";

/** "נמצאו 20 הזדמנויות לחיסכון בחשבונית": התראה אחת עם הסכום, במקום התראה לכל מוצר */
export function invoiceSavingsText(count: number, savingAgorot: number, supplierName: string | null) {
  return {
    title: `נמצאו ${count} הזדמנויות לחיסכון בחשבונית${supplierName ? ` מ${supplierName}` : ""}`,
    body:
      savingAgorot > 0
        ? `פוטנציאל החיסכון: ${shekels(savingAgorot)} בחודש, אחרי מינימום הזמנה.`
        : "יש מוצרים שזולים יותר אצל ספקים אחרים, אבל המעבר לא משתלם כרגע בגלל מינימום ההזמנה.",
  };
}

export async function notifyInvoiceSavings(
  customerId: string,
  basketId: string,
  invoiceId: string,
  supplierName: string | null,
) {
  try {
    const [basket, analysis] = await Promise.all([getBasket(customerId, basketId), analyzeBasket(basketId)]);
    if (!basket) return;
    const paid = paidComparison(basket, analysis);
    const count = paid.lines.filter((l) => l.monthlySavingAgorot > 0).length;
    if (count === 0) return;
    await notify([
      {
        customerId,
        kind: "INVOICE_SAVINGS",
        ...invoiceSavingsText(count, paid.monthlySavingAgorot, supplierName),
        href: `/customer/baskets/${basketId}`,
        savingsAgorot: paid.monthlySavingAgorot || undefined,
        dedupeKey: `invoice-savings:${invoiceId}`,
      },
    ]);
  } catch (e) {
    console.error("invoice savings notification failed", e);
  }
}
