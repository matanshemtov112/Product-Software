"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { REPORT_REASON_LABEL } from "@/lib/reports";
import { createReport } from "@/lib/reports-actions";

/** כפתור "דיווח" קטן שנפתח לטופס: סיבה ופירוט. הדיווח מגיע רק לצוות הפלטפורמה */
export function ReportButton({ targetId, targetName, path }: { targetId: string; targetName: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createReport, {});
  if (state.sent) {
    return (
      <p role="status" className="text-sm text-muted">
        תודה. הדיווח על {targetName} הגיע לצוות הפלטפורמה, והוא לא מוצג ל{targetName}.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-danger">
        דיווח על {targetName}
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="font-medium">דיווח על {targetName}</p>
      <p className="text-sm text-muted">הדיווח מגיע רק לצוות הפלטפורמה, ו{targetName} לא יודע מי דיווח.</p>
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="path" value={path} />
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 text-muted">מה הבעיה?</legend>
        {Object.entries(REPORT_REASON_LABEL).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={value} required className="accent-accent" />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">פרטים (לא חובה, חוץ מ״אחר״)</span>
        <textarea
          name="text"
          rows={3}
          maxLength={1000}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
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
