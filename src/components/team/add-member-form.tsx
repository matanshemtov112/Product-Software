"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { addMember } from "@/lib/auth/team-actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם מלא">
          <Input name="name" required />
        </Field>
        <Field label="אימייל (משמש להתחברות)">
          <Input name="email" type="email" dir="ltr" required />
        </Field>
        <Field label="טלפון">
          <Input name="phone" type="tel" dir="ltr" />
        </Field>
        <Field label="סיסמה ראשונית (8 תווים לפחות)">
          <Input name="password" type="text" dir="ltr" minLength={8} autoComplete="off" required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isManager" className="accent-accent" />
        מנהל: יכול לערוך את פרטי העסק ולנהל את הצוות
      </label>
      <FormError message={state.error} />
      {state.added && !state.error && (
        <p role="status" className="text-sm text-accent">
          המשתמש נוסף. מסרו לו את האימייל {state.added} ואת הסיסמה הראשונית, כדי שיתחבר.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>הוספת משתמש</SubmitButton>
      </div>
    </ActionForm>
  );
}
