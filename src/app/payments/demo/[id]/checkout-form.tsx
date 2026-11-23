"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { authorizeDemoHold } from "./actions";

export function DemoCheckoutForm({ holdId, amount }: { holdId: string; amount: string }) {
  const [state, action, pending] = useActionState(authorizeDemoHold, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="holdId" value={holdId} />
      <Field label="מספר כרטיס">
        <Input
          name="cardNumber"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          required
          placeholder="4580 0000 0000 0000"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תוקף (MM/YY)">
          <Input name="expiry" inputMode="numeric" autoComplete="off" dir="ltr" required placeholder="12/28" />
        </Field>
        <Field label="3 ספרות בגב הכרטיס">
          <Input name="cvv" inputMode="numeric" autoComplete="off" dir="ltr" required maxLength={4} />
        </Field>
      </div>
      <Field label="תעודת זהות של בעל הכרטיס">
        <Input name="holderId" inputMode="numeric" autoComplete="off" dir="ltr" required maxLength={9} />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>{pending ? "מאשרים…" : `אישור מסגרת של ${amount}`}</SubmitButton>
    </ActionForm>
  );
}
