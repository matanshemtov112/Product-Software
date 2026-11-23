"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { openBuyingAccount } from "@/lib/auth/actions";

const BUSINESS_TYPES = ["יצרן מזון", "מאפייה", "קייטרינג", "ספק / מפיץ", "אחר"];

export function OpenBuyingForm({ regions, city }: { regions: { id: string; name: string }[]; city?: string }) {
  const [state, action, pending] = useActionState(openBuyingAccount, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="סוג העסק כקונה">
        <Select name="businessType" defaultValue={BUSINESS_TYPES[0]}>
          {BUSINESS_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="עיר (לאן מביאים לכם את הסחורה)">
        <Input name="city" autoComplete="address-level2" defaultValue={city} required />
      </Field>
      <Field label="כתובת (לא חובה)">
        <Input name="address" autoComplete="street-address" placeholder="רחוב ומספר" />
      </Field>
      <Field label="אזור">
        <Select name="regionId" required defaultValue="">
          <option value="" disabled>
            בחירת אזור
          </option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>פתיחת חשבון קנייה</SubmitButton>
    </ActionForm>
  );
}
