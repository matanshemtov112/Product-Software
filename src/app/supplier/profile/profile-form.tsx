"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { updateProfile } from "../actions";

export function ProfileForm({
  initial,
}: {
  initial: { companyName: string; contactPhone: string; contactEmail: string; minOrder: number; paymentTermsDays: number };
}) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם החברה">
          <Input name="companyName" defaultValue={initial.companyName} required />
        </Field>
        <Field label="טלפון ליצירת קשר">
          <Input name="contactPhone" type="tel" defaultValue={initial.contactPhone} dir="ltr" />
        </Field>
        <Field label="אימייל ליצירת קשר">
          <Input name="contactEmail" type="email" defaultValue={initial.contactEmail} dir="ltr" />
        </Field>
        <Field label="מינימום הזמנה לאספקה (₪, ללא מע״מ)">
          <Input name="minOrder" type="number" step="1" min="0" defaultValue={initial.minOrder} dir="ltr" />
        </Field>
        <Field label="תנאי תשלום (שוטף + ימים)">
          <Input name="paymentTermsDays" type="number" step="1" min="0" max="180" defaultValue={initial.paymentTermsDays} dir="ltr" />
        </Field>
      </div>
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          הפרטים נשמרו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>שמירה</SubmitButton>
      </div>
    </ActionForm>
  );
}
