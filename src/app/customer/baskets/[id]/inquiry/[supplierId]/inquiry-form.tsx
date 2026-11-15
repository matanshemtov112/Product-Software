"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError } from "@/components/form";
import { SendToSupplierButton } from "@/components/send-to-supplier";
import { sendInquiry } from "../../../../actions";

export function InquiryForm({
  basketId,
  supplierId,
  defaultMessage,
  sharedMessage,
  paidCount,
  seen,
}: {
  basketId: string;
  supplierId: string;
  defaultMessage: string;
  /** ההודעה המוצעת כשהלקוח משתף את המחירים שהוא משלם היום */
  sharedMessage: string;
  /** בכמה מוצרים הלקוח מילא מחיר שהוא משלם היום (0: אין מה לשתף) */
  paidCount: number;
  /** ההצעה כפי שהוצגה בדף, לזיהוי שינוי מחיר עד השליחה */
  seen: string;
}) {
  const [state, action, pending] = useActionState(sendInquiry, {});
  const [share, setShare] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [edited, setEdited] = useState(false);
  const toggleShare = (on: boolean) => {
    setShare(on);
    // ההודעה המוצעת מתעדכנת לפי הבחירה, כל עוד הלקוח לא כתב בה בעצמו
    if (!edited) setMessage(on ? sharedMessage : defaultMessage);
  };
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="basketId" value={basketId} />
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="seen" value={state.seen ?? seen} />
      <textarea
        name="message"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setEdited(true);
        }}
        rows={5}
        maxLength={1000}
        aria-label="ההודעה לספק"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        required
      />
      {paidCount > 0 && (
        <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="sharePaid"
            checked={share}
            onChange={(e) => toggleShare(e.target.checked)}
            className="mt-1 accent-accent"
          />
          <span>
            להראות לספק את המחירים שאני משלם היום ({paidCount} מוצרים)
            <span className="block text-xs text-muted">
              עוזר לספק להציע מחיר מדויק, אבל חושף לו כמה אתם משלמים. בלי הסימון הספק רואה רק את המחירים שלו.
            </span>
          </span>
        </label>
      )}
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
