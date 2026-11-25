"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { resetPassword } from "@/lib/auth/password-actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="t" value={token} />
      <Field label="סיסמה חדשה (8 תווים לפחות)">
        <Input name="newPassword" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
      </Field>
      <Field label="הסיסמה החדשה שוב">
        <Input name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>שמירת הסיסמה וכניסה</SubmitButton>
    </ActionForm>
  );
}
