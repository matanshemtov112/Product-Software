"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { verifyMfa } from "@/lib/auth/two-factor-actions";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyMfa, {});
  const [recovery, setRecovery] = useState(false);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {recovery ? (
        <Field label="קוד גיבוי (למשל a1b2c-3d4e5)">
          <Input name="code" autoComplete="off" dir="ltr" required autoFocus />
        </Field>
      ) : (
        <Field label="הקוד בן 6 הספרות מאפליקציית האימות">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            dir="ltr"
            required
            autoFocus
          />
        </Field>
      )}
      <FormError message={state.error} />
      <SubmitButton pending={pending}>אישור וכניסה</SubmitButton>
      <button type="button" className="text-sm text-accent hover:underline" onClick={() => setRecovery((r) => !r)}>
        {recovery ? "חזרה לקוד מהאפליקציה" : "אין לי גישה לטלפון: כניסה עם קוד גיבוי"}
      </button>
    </ActionForm>
  );
}
