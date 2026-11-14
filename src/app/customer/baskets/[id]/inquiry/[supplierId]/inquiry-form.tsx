"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError } from "@/components/form";
import { SendToSupplierButton } from "@/components/send-to-supplier";
import { sendInquiry } from "../../../../actions";

export function InquiryForm({
  basketId,
  supplierId,
  defaultMessage,
  seen,
}: {
  basketId: string;
  supplierId: string;
  defaultMessage: string;
  /** ההצעה כפי שהוצגה בדף, לזיהוי שינוי מחיר עד השליחה */
  seen: string;
}) {
  const [state, action, pending] = useActionState(sendInquiry, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="basketId" value={basketId} />
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="seen" value={state.seen ?? seen} />
      <textarea
        name="message"
        defaultValue={defaultMessage}
        rows={5}
        maxLength={1000}
        aria-label="ההודעה לספק"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        required
      />
      <FormError message={state.error} />
      {state.changes && (
        <ul role="alert" className="flex flex-col gap-1 rounded-md border border-danger bg-danger/5 px-3 py-2 text-sm">
          {state.changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div>
        <SendToSupplierButton pending={pending} />
      </div>
    </ActionForm>
  );
}
