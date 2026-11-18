"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { savePrefs } from "@/lib/notify/prefs-actions";

export interface PrefRow {
  category: string;
  title: string;
  description: string;
  locked: boolean;
  inApp: boolean;
  email: string;
  options: { value: string; label: string }[];
}

export function PrefsForm({ rows }: { rows: PrefRow[] }) {
  const [state, action, pending] = useActionState(savePrefs, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.category} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 sm:max-w-md">
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-muted">{r.description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={`inApp_${r.category}`}
                  defaultChecked={r.inApp}
                  disabled={r.locked}
                  className="accent-accent"
                />
                במערכת
              </label>
              <label className="flex items-center gap-2">
                <span>אימייל:</span>
                {r.locked ? (
                  <span className="font-medium">מיד, תמיד</span>
                ) : (
                  <select
                    name={`email_${r.category}`}
                    defaultValue={r.email}
                    className="rounded-md border border-border bg-surface px-2 py-1"
                  >
                    {r.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
          </li>
        ))}
      </ul>
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          ההגדרות נשמרו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>שמירת ההגדרות</SubmitButton>
      </div>
    </ActionForm>
  );
}
