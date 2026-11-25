"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { requestPasswordReset } from "@/lib/auth/password-actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  if (state.done) {
    return (
      <p className="text-sm" role="status">
        אם האימייל רשום אצלנו, שלחנו אליו קישור לבחירת סיסמה חדשה. הקישור בתוקף שעה. לא הגיע? בדקו בתיקיית הספאם.
      </p>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="האימייל שאיתו נרשמתם">
        <Input name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>שליחת קישור לאיפוס</SubmitButton>
    </ActionForm>
  );
}
