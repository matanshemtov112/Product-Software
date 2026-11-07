"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { StarInput } from "@/components/star-input";
import { saveCustomerReview } from "../../actions";

export interface ExistingCustomerReview {
  overall: number;
  payment: number;
  communication: number;
  text: string | null;
}

export function CustomerReviewForm({
  inquiryId,
  customerId,
  existing,
}: {
  inquiryId: string;
  customerId: string;
  existing: ExistingCustomerReview | null;
}) {
  const [state, action, pending] = useActionState(saveCustomerReview, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex max-w-sm flex-col gap-1">
        <StarInput name="overall" label="דירוג כללי" defaultValue={existing?.overall} />
        <StarInput name="payment" label="עמידה בתנאי תשלום" defaultValue={existing?.payment} />
        <StarInput name="communication" label="תקשורת והתנהלות" defaultValue={existing?.communication} />
      </div>
      <textarea
        name="text"
        rows={3}
        maxLength={1000}
        defaultValue={existing?.text ?? ""}
        placeholder="למשל: משלמים בזמן, מזמינים מראש ומסודרים בקבלת סחורה."
        aria-label="הערה על הלקוח"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{existing ? "עדכון הביקורת" : "שמירת הביקורת"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
