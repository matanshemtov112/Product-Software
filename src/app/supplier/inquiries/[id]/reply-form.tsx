"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { PaymentTermsSelect } from "@/components/payment-terms-select";
import { NO_VALIDITY, VALID_DAYS } from "@/lib/matches";
import { replyInquiry } from "../../actions";

export function ReplyForm({
  inquiryId,
  hasReply,
  paymentTermsDays,
  hasValidity,
}: {
  inquiryId: string;
  hasReply: boolean;
  paymentTermsDays: number | null;
  hasValidity: boolean;
}) {
  const [state, action, pending] = useActionState(replyInquiry, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <textarea
        name="reply"
        rows={4}
        maxLength={1000}
        placeholder="למשל: נוכל להוריד את מחיר חזה העוף ל-₪30 לק״ג בהתחייבות חודשית. ניצור קשר מחר."
        aria-label="התשובה ללקוח"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        required
      />
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">סוג התשובה</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="status" value="OFFERED" defaultChecked className="accent-accent" />
          שלחנו הצעה / ניצור קשר
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="status" value="CLOSED" className="accent-accent" />
          לא נוכל להתאים את המחיר
        </label>
      </fieldset>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">תוקף להצעה שלכם (לא חובה)</span>
        <select
          name="validDays"
          defaultValue={hasReply && !hasValidity ? String(NO_VALIDITY) : "30"}
          className="rounded-md border border-border bg-surface px-2 py-1 text-base outline-none focus:border-accent"
        >
          <option value={NO_VALIDITY}>בלי תוקף</option>
          {VALID_DAYS.map((d) => (
            <option key={d} value={d}>
              {d} ימים
            </option>
          ))}
        </select>
      </label>
      <PaymentTermsSelect defaultValue={paymentTermsDays} />
      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{hasReply ? "שליחת תשובה מעודכנת" : "שליחת התשובה"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
