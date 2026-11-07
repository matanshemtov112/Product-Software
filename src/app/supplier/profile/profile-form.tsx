"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { updateProfile } from "../actions";

const textarea =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function ProfileForm({
  initial,
}: {
  initial: {
    companyName: string;
    contactPhone: string;
    contactEmail: string;
    minOrder: number;
    paymentTermsDays: number;
    description: string;
    openingHours: string;
    deliveryTerms: string;
    logoUrl: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {initial.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initial.logoUrl}
            alt={`הלוגו של ${initial.companyName}`}
            className="size-16 rounded-lg border border-border bg-white object-contain"
          />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
            אין לוגו
          </span>
        )}
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1">
            <span>לוגו (JPG, PNG או WEBP, עד 2MB)</span>
            <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          </label>
          {initial.logoUrl && (
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" name="removeLogo" className="accent-accent" />
              הסרת הלוגו
            </label>
          )}
        </div>
      </div>
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
        <Field label="שעות פעילות">
          <Input
            name="openingHours"
            defaultValue={initial.openingHours}
            placeholder="למשל: א׳ עד ה׳ משש בבוקר עד שתיים"
          />
        </Field>
        <Field label="מינימום הזמנה לאספקה (₪, ללא מע״מ)">
          <Input name="minOrder" type="number" step="1" min="0" defaultValue={initial.minOrder} dir="ltr" />
        </Field>
        <Field label="תנאי תשלום (שוטף + ימים)">
          <Input
            name="paymentTermsDays"
            type="number"
            step="1"
            min="0"
            max="180"
            defaultValue={initial.paymentTermsDays}
            dir="ltr"
          />
        </Field>
      </div>
      <Field label="תנאי אספקה">
        <textarea
          name="deliveryTerms"
          rows={2}
          maxLength={300}
          defaultValue={initial.deliveryTerms}
          placeholder="למשל: הזמנה עד 14:00 מגיעה למחרת בבוקר. אספקה בקירור."
          className={textarea}
        />
      </Field>
      <Field label="על החברה (מוצג ללקוחות)">
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={initial.description}
          placeholder="למשל: סיטונאות בשר ועוף מאז 1998, משרתים מסעדות במרכז ובשרון."
          className={textarea}
        />
      </Field>
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
