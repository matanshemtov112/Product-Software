"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { register } from "@/lib/auth/actions";

const BUSINESS_TYPES = ["מסעדה", "בית קפה", "קייטרינג", "מלון", "מאפייה", "יצרן מזון", "אחר"];

export function RegisterForm({
  regions,
  initialKind,
}: {
  regions: { id: string; name: string }[];
  initialKind: "customer" | "supplier";
}) {
  const [kind, setKind] = useState(initialKind);
  const [state, action, pending] = useActionState(register, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {(["customer", "supplier"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-md border px-3 py-2 ${kind === k ? "border-accent bg-accent-soft font-medium" : "border-border"}`}
          >
            {k === "customer" ? "עסק שקונה" : "ספק"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      <Field label="שם מלא">
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="אימייל">
        <Input name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>
      <Field label="טלפון">
        <Input name="phone" type="tel" autoComplete="tel" dir="ltr" />
      </Field>
      <Field label="סיסמה (8 תווים לפחות)">
        <Input name="password" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
      </Field>

      {kind === "customer" ? (
        <>
          <Field label="שם העסק">
            <Input name="businessName" required />
          </Field>
          <Field label="סוג העסק">
            <Select name="businessType" defaultValue={BUSINESS_TYPES[0]}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="עיר">
            <Input name="city" required />
          </Field>
          <Field label="אזור אספקה">
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
          <Field label="מה חשוב לכם?">
            <Select name="preference" defaultValue="BALANCED">
              <option value="PRICE">מחיר קודם: תמיד הזול ביותר</option>
              <option value="BALANCED">מאוזן: התמורה הכוללת הטובה ביותר</option>
              <option value="SERVICE">שירות קודם: מוכנים לשלם מעט יותר על אמינות</option>
            </Select>
          </Field>
        </>
      ) : (
        <>
          <Field label="שם החברה">
            <Input name="companyName" required />
          </Field>
          <Field label="ח.פ.">
            <Input name="companyNumber" inputMode="numeric" pattern="\d{9}" dir="ltr" required />
          </Field>
          <p className="text-sm text-muted">ספק חדש מופיע בהשוואות רק אחרי אישור של צוות הפלטפורמה.</p>
        </>
      )}

      <FormError message={state.error} />
      <SubmitButton pending={pending}>הרשמה</SubmitButton>
    </form>
  );
}
