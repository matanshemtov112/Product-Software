"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { saveBusinessDetails } from "../actions";

export function BusinessForm({ city, address, totalVolume }: { city: string; address: string; totalVolume: string }) {
  const [state, action, pending] = useActionState(saveBusinessDetails, {});
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="עיר">
        <Input name="city" defaultValue={city} autoComplete="address-level2" required />
      </Field>
      <Field label="כתובת העסק">
        <Input name="address" defaultValue={address} autoComplete="street-address" placeholder="רחוב ומספר" />
      </Field>
      <Field label="היקף רכש חודשי כולל, מכל הספקים">
        <Select name="totalVolume" defaultValue={totalVolume}>
          <option value="">לא צוין</option>
          {VOLUME_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <p className="self-end text-xs text-muted">
        ההיקף הכולל מוצג לספקים כשאתם פונים אליהם. מדרגת המחיר אצל כל ספק נקבעת לפי מה שתקנו אצלו, כפי שמילאתם בסל.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>שמירה</SubmitButton>
        {"saved" in state && state.saved && (
          <span role="status" className="text-sm text-accent">
            נשמר
          </span>
        )}
      </div>
      <FormError message={state.error} />
    </ActionForm>
  );
}
