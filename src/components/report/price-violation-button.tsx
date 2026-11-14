"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { reportPriceViolation } from "@/app/customer/violations/actions";
import { priceOn, type PricePeriod } from "@/lib/price-on";

export interface ViolationProduct {
  id: string;
  name: string;
  unitLabel: string;
  /** המחיר במערכת במדרגה הראשונה, כנקודת התחלה; הלקוח יכול לתקן למחיר שסוכם איתו */
  priceAgorot: number | null;
  /** המחירים בתקופת הדיווח, כדי למלא את המחיר שהיה בתוקף ביום האספקה */
  history?: PricePeriod[];
}

const field =
  "rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";
const toShekels = (agorot: number | null) => (agorot === null ? "" : (agorot / 100).toFixed(2));

/** דיווח על ספק שגבה מחיר גבוה מהמחיר שהופיע במערכת או שסוכם */
export function PriceViolationButton({
  supplierId,
  supplierName,
  products,
}: {
  supplierId: string;
  supplierName: string;
  products: ViolationProduct[];
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [shown, setShown] = useState("");
  const [state, action, pending] = useActionState(reportPriceViolation, {});
  const product = products.find((p) => p.id === productId);
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  // המחיר שהיה במערכת ביום האספקה (לא המחיר של היום, שאולי השתנה מאז)
  const priceFor = (id: string, on: string) => {
    const p = products.find((x) => x.id === id);
    return toShekels(p ? (priceOn(p.history ?? [], on) ?? p.priceAgorot) : null);
  };

  if (state.sent) {
    return (
      <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
        תודה. הדיווח על הפרת המחיר אצל {supplierName} הגיע לצוות הפלטפורמה. הספק לא יודע מי דיווח.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-danger hover:text-danger"
      >
        דיווח על הפרת מחיר
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="font-medium">דיווח על הפרת מחיר אצל {supplierName}</p>
      <p className="text-sm text-muted">
        הספק גבה מכם מחיר גבוה יותר מהמחיר שמופיע במערכת או שסוכם איתכם? ספרו לנו. הדיווח מגיע לצוות הפלטפורמה, והספק לא
        יודע מי דיווח. המחירים ללא מע״מ.
      </p>
      <input type="hidden" name="supplierId" value={supplierId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">המוצר</span>
        <select
          name="productId"
          required
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setShown(priceFor(e.target.value, day));
          }}
          className={field}
        >
          <option value="">בחרו מוצר</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">המחיר במערכת או שסוכם (₪{product ? ` ל${product.unitLabel}` : ""})</span>
          <input
            name="shownPrice"
            inputMode="decimal"
            required
            value={shown}
            onChange={(e) => setShown(e.target.value)}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">המחיר שנגבה בפועל (₪{product ? ` ל${product.unitLabel}` : ""})</span>
          <input name="chargedPrice" inputMode="decimal" required className={field} dir="ltr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">תאריך האספקה</span>
          <input
            name="occurredOn"
            type="date"
            required
            value={day}
            max={today}
            onChange={(e) => {
              setDay(e.target.value);
              if (productId) setShown(priceFor(productId, e.target.value));
            }}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">פרטים (לא חובה), למשל מספר חשבונית</span>
        <textarea name="text" rows={2} maxLength={500} className={field} />
      </label>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>שליחת הדיווח</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
          ביטול
        </button>
      </div>
    </ActionForm>
  );
}
