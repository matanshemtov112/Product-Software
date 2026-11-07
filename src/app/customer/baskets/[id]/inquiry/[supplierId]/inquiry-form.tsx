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
}: {
  basketId: string;
  supplierId: string;
  defaultMessage: string;
}) {
  const [state, action, pending] = useActionState(sendInquiry, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="basketId" value={basketId} />
      <input type="hidden" name="supplierId" value={supplierId} />
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
      <div>
        <SendToSupplierButton pending={pending} />
      </div>
    </ActionForm>
  );
}
