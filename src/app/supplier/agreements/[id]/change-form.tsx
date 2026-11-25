"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";

const box = "rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent";
import { requestGuaranteeChange, type ChangeState } from "../actions";

/** בקשה לשינוי מחיר מובטח של מוצר אחד; נפתח בלחיצה */
export function ChangeRequest({ lineId, unitLabel }: { lineId: string; unitLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(requestGuaranteeChange, {} as ChangeState);
  if (state.sent) return <span className="text-xs text-good">הבקשה נשלחה ללקוח</span>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:underline"
        data-needs="prices"
      >
        בקשה לשינוי מחיר
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col items-end gap-2 text-start">
      <input type="hidden" name="lineId" value={lineId} />
      <label className="flex items-center gap-2 text-xs">
        מחיר חדש ל{unitLabel}
        <input name="price" inputMode="decimal" required className={`${box} w-24`} aria-label="מחיר חדש" />
      </label>
      <input name="reason" maxLength={200} placeholder="הסיבה (לא חובה)" className={`${box} w-56`} aria-label="הסיבה" />
      <SubmitButton pending={pending}>שליחה ללקוח</SubmitButton>
      <FormError message={state.error} />
    </ActionForm>
  );
}
