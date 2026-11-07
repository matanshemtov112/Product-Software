"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input } from "@/components/form";
import { SendToSupplierButton } from "@/components/send-to-supplier";
import { sendDealInquiry } from "../../actions";

export function DealInquiryForm({
  offerId,
  unitLabel,
  suggestedQuantity,
  deliveries,
  defaultMessage,
}: {
  offerId: string;
  unitLabel: string;
  suggestedQuantity: string;
  deliveries: number;
  defaultMessage: string;
}) {
  const [state, action, pending] = useActionState(sendDealInquiry, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="offerId" value={offerId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`כמה ${unitLabel} בכל הזמנה (לא חובה)`}>
          <Input name="quantity" type="number" step="any" min="0" defaultValue={suggestedQuantity} dir="ltr" />
        </Field>
        <Field label="הזמנות בחודש">
          <Input name="deliveries" type="number" min="1" max="31" defaultValue={deliveries} dir="ltr" />
        </Field>
      </div>
      <textarea
        name="message"
        defaultValue={defaultMessage}
        rows={4}
        maxLength={1000}
        aria-label="ההודעה לספק"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        required
      />
      <p className="text-xs text-muted">הספק יקבל את פרטי העסק שלכם, את המבצע והכמות. שם הספק הנוכחי שלכם לא נשלח.</p>
      <FormError message={state.error} />
      <div>
        <SendToSupplierButton pending={pending} />
      </div>
    </ActionForm>
  );
}
