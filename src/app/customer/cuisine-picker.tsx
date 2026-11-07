"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { saveCuisine } from "./actions";

export function CuisinePicker({
  cuisines,
  initial,
  submitLabel,
  next,
}: {
  cuisines: string[];
  initial: string | null;
  submitLabel: string;
  next?: "new";
}) {
  const [state, action, pending] = useActionState(saveCuisine, {});
  const [value, setValue] = useState(initial);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div role="radiogroup" aria-label="סוג המסעדה" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cuisines.map((c) => (
          <label
            key={c}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 text-sm ${
              value === c ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface hover:bg-background"
            }`}
          >
            <input
              type="radio"
              name="cuisine"
              value={c}
              checked={value === c}
              onChange={() => setValue(c)}
              className="accent-accent"
            />
            {c}
          </label>
        ))}
      </div>
      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
