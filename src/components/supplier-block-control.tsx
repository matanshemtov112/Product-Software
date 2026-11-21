import { updateSupplierBlock } from "@/app/customer/blocks/actions";
import { blockOf } from "@/lib/supplier-blocks";

/**
 * השתקה או חסימה של ספק מתוך דף שקשור אליו. הספק לא יודע על כך.
 * מוצג בתחתית הדף, כדי שלא ילחצו בטעות.
 */
export async function SupplierBlockControl({
  customerId,
  supplierId,
  supplierName,
  back,
}: {
  customerId: string;
  supplierId: string;
  supplierName: string;
  back: string;
}) {
  const mode = await blockOf(customerId, supplierId);
  const button = (value: string, label: string, danger = false) => (
    <button
      name="mode"
      value={value}
      className={`rounded-md border border-border px-3 py-1.5 ${danger ? "hover:border-danger hover:text-danger" : "hover:bg-background"}`}
    >
      {label}
    </button>
  );
  return (
    <details data-needs="buy" className="rounded-lg border border-border bg-surface p-4 text-sm" open={Boolean(mode)}>
      <summary className="cursor-pointer text-muted">
        {mode === "BLOCK"
          ? `${supplierName} חסום אצלכם`
          : mode === "MUTE"
            ? `${supplierName} מושתק אצלכם`
            : `לא רוצים לשמוע מ${supplierName}?`}
      </summary>
      <form action={updateSupplierBlock} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="supplierId" value={supplierId} />
        <input type="hidden" name="back" value={back} />
        <p className="text-muted">
          השתקה: בלי התראות על המחירים והמבצעים שלו, אבל תשובות לפניות שלכם עדיין יגיעו. חסימה: הוא לא יופיע בהשוואות
          שלכם, הפניות הפתוחות אליו יבוטלו, והוא לא יוכל לענות לכם. הספק לא יודע על כך.
        </p>
        <div className="flex flex-wrap gap-2">
          {mode !== "MUTE" && button("MUTE", "השתקה")}
          {mode !== "BLOCK" && button("BLOCK", "חסימה", true)}
          {mode && button("NONE", mode === "BLOCK" ? "ביטול החסימה" : "ביטול ההשתקה")}
        </div>
      </form>
    </details>
  );
}
