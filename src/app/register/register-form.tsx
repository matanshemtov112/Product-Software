"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { register } from "@/lib/auth/actions";
import { KindToggle } from "@/components/kind-toggle";
import { VOLUME_RANGES } from "@/lib/customer/volume";

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
    <ActionForm action={action} className="flex flex-col gap-4">
      <KindToggle value={kind} onChange={setKind} />

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
            <Input name="city" autoComplete="address-level2" required />
          </Field>
          <Field label="כתובת העסק (לא חובה)">
            <Input name="address" autoComplete="street-address" placeholder="רחוב ומספר" />
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
          <Field label="היקף רכש חודשי כולל, מכל הספקים (לא חובה)">
            <Select name="totalVolume" defaultValue="">
              <option value="">מעדיפים לא לציין כרגע</option>
              {VOLUME_RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
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
    </ActionForm>
  );
}
