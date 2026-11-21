"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { addMember } from "@/lib/auth/team-actions";

interface RoleOption {
  value: string;
  label: string;
  description: string;
}

export function AddMemberForm({ options }: { options: RoleOption[] }) {
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">תפקיד</legend>
        {options.map((o, i) => (
          <label key={o.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="teamRole"
              value={o.value}
              defaultChecked={i === 1}
              required
              className="mt-1 accent-accent"
            />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="text-muted">: {o.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
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
