"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { uploadDocument } from "./actions";

/** העלאה של מסמך אחד: קובץ ותוקף (לא חובה) */
export function UploadForm({ kind, hasFile, askValidity }: { kind: string; hasFile: boolean; askValidity: boolean }) {
  const [state, action, pending] = useActionState(uploadDocument, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-muted">קובץ PDF, JPG או PNG, עד 5MB</span>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            aria-label="קובץ המסמך"
            className="max-w-full text-sm"
          />
        </label>
        {askValidity && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">בתוקף עד (אם מופיע במסמך)</span>
            <input
              type="date"
              name="validUntil"
              min={today}
              aria-label="תוקף המסמך"
              className="rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
        )}
        <SubmitButton pending={pending}>{hasFile ? "העלאת מסמך מעודכן" : "העלאה"}</SubmitButton>
      </div>
      {state.saved && <p className="text-sm text-accent">המסמך התקבל ועבר לבדיקה של צוות הפלטפורמה.</p>}
      <FormError message={state.error} />
    </ActionForm>
  );
}
