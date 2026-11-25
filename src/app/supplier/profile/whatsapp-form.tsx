"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { saveWhatsapp } from "../actions";

/** הפעלה או כיבוי של כפתור הוואטסאפ ללקוחות שקיבלו הצעה, ומספר להזמנות */
export function WhatsappForm({
  initial,
  contactPhone,
}: {
  initial: { enabled: boolean; phone: string };
  contactPhone: string | null;
}) {
  const [state, action, pending] = useActionState(saveWhatsapp, {});
  const [enabled, setEnabled] = useState(initial.enabled);
  return (
    <ActionForm action={action} className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        כשלקוח מקבל הצעה שלכם, גם הוא וגם אתם מקבלים כפתור &quot;המשך בוואטסאפ&quot;. הוא פותח שיחה עם הודעה מוכנה: מספר
        העסקה, עד מתי המחיר מובטח, וקישור לעמוד העסקה. עסק שלא עובד בוואטסאפ יכול לכבות את זה.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 accent-accent"
        />
        <span className="font-medium">לקוחות יכולים לפנות אלינו בוואטסאפ</span>
      </label>
      {enabled && (
        <Field label="מספר וואטסאפ להזמנות (לא חובה)">
          <Input
            name="phone"
            defaultValue={initial.phone}
            inputMode="tel"
            dir="ltr"
            maxLength={20}
            placeholder={contactPhone ?? "050-1234567"}
          />
        </Field>
      )}
      {enabled && (
        <p className="text-xs text-muted">
          {contactPhone
            ? `אם תשאירו ריק, הלקוחות יפנו לטלפון שבפרטי החברה (${contactPhone}).`
            : "אין טלפון בפרטי החברה, אז צריך למלא כאן מספר."}
        </p>
      )}
      {!enabled && <input type="hidden" name="phone" value={initial.phone} />}
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>שמירה</SubmitButton>
        {"saved" in state && state.saved && (
          <span role="status" className="text-good">
            נשמר
          </span>
        )}
      </div>
      <FormError message={state.error} />
    </ActionForm>
  );
}
