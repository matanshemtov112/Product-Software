"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { saveDomains } from "./actions";

/** בחירת התחומים של הספק: כמה סוגי מוצרים, או כל התחומים */
export function DomainPicker({
  categories,
  initialIds,
  initialAll,
  submitLabel,
}: {
  categories: { id: string; name: string }[];
  initialIds: string[];
  initialAll: boolean;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveDomains, {});
  const [all, setAll] = useState(initialAll);
  const [selected, setSelected] = useState(new Set(initialIds));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chip = (on: boolean, disabled = false) =>
    `flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
      on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface hover:bg-background"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <label className={chip(all)}>
        <input type="checkbox" name="all" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4 accent-accent" />
        <span>
          כל התחומים
          <span className="block text-xs font-normal text-muted">ספק כללי שמוכר מכל סוגי המוצרים</span>
        </span>
      </label>
      <fieldset disabled={all} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-muted">או בחירה של תחום אחד או יותר:</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <label key={c.id} className={chip(!all && selected.has(c.id), all)}>
              <input
                type="checkbox"
                name="categoryId"
                value={c.id}
                checked={!all && selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="size-4 accent-accent"
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          התחומים נשמרו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
