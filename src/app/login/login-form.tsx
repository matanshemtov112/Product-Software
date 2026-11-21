"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { type AccountKind, KindToggle } from "@/components/kind-toggle";
import { login } from "@/lib/auth/actions";

export function LoginForm({ initialKind }: { initialKind: AccountKind }) {
  const [kind, setKind] = useState(initialKind);
  const [state, action, pending] = useActionState(login, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <KindToggle value={kind} onChange={setKind} prefix="כניסה כ" />
      <Field label="אימייל">
        <Input name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>
      <Field label="סיסמה">
        <Input name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>{kind === "supplier" ? "כניסה לאזור הספק" : "כניסה לאזור המסעדה"}</SubmitButton>
    </ActionForm>
  );
}
