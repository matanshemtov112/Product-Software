"use client";

import { useActionState } from "react";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { login } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="אימייל">
        <Input name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>
      <Field label="סיסמה">
        <Input name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>כניסה</SubmitButton>
    </form>
  );
}
