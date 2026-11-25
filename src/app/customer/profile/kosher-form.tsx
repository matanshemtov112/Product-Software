"use client";

import type { KosherLevel } from "@prisma/client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { KOSHER_LEVELS, KOSHER_REQUIRED_LABELS } from "@/lib/kosher";
import { saveKosherRequired } from "../actions";

const HINTS: Record<KosherLevel, string> = {
  NONE: "נשווה בין כל הספקים והמוצרים",
  KOSHER: "נציג רק מוצרים שהספק סימן ככשרים (כולל מהדרין)",
  MEHADRIN: "נציג רק מוצרים שהספק סימן ככשרים למהדרין",
};

export function KosherForm({ initial }: { initial: KosherLevel }) {
  const [state, action, pending] = useActionState(saveKosherRequired, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {KOSHER_LEVELS.map((l) => (
          <label
            key={l}
            className="flex cursor-pointer items-start gap-2 rounded-2xl border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input type="radio" name="kosherRequired" value={l} defaultChecked={initial === l} className="mt-1" />
            <span>
              <span className="block font-medium">{KOSHER_REQUIRED_LABELS[l]}</span>
              <span className="block text-xs text-muted">{HINTS[l]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">
        מוצר שהספק לא סימן לו כשרות לא יוצג כשאתם דורשים כשרות. כדאי לבקש מהספק לוודא את התעודה לפני הזמנה.
      </p>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>שמירה</SubmitButton>
        {"saved" in state && state.saved && (
          <span role="status" className="text-sm text-good">
            נשמר
          </span>
        )}
      </div>
      <FormError message={state.error} />
    </ActionForm>
  );
}
