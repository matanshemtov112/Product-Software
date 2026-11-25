"use client";

import type { KosherLevel } from "@prisma/client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { KOSHER_LABELS, KOSHER_LEVELS } from "@/lib/kosher";
import { saveKosherDefault } from "../actions";

/** הכשרות הכללית של הספק; מוצר יכול לסמן כשרות אחרת בעמוד המוצר */
export function KosherDefaultForm({
  initial,
  differentCount,
}: {
  initial: { level: KosherLevel | null; authority: string };
  /** כמה מוצרים סומנו בכשרות משלהם */
  differentCount: number;
}) {
  const [state, action, pending] = useActionState(saveKosherDefault, {});
  const [level, setLevel] = useState<string>(initial.level ?? "");
  const needsAuthority = level === "KOSHER" || level === "MEHADRIN";
  return (
    <ActionForm action={action} className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        מסעדות שעובדות כשר יראו רק מוצרים שסימנתם ככשרים. מה שתבחרו כאן חל על כל המוצרים שלכם, ואפשר לסמן כשרות אחרת
        למוצר מסוים בעמוד המוצר.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="הכשרות של רוב המוצרים שלנו">
          <Select name="kosherDefault" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">לא סימנו</option>
            {KOSHER_LEVELS.map((l) => (
              <option key={l} value={l}>
                {KOSHER_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
        {needsAuthority && (
          <Field label="מי נותן את הכשרות">
            <Input
              name="kosherAuthority"
              defaultValue={initial.authority}
              maxLength={80}
              placeholder="למשל רבנות חיפה, בד״ץ העדה החרדית"
              required
            />
          </Field>
        )}
      </div>
      {level === "" && (
        <p className="rounded-2xl bg-sand px-3 py-2">כל עוד לא סימנתם, המוצרים שלכם לא יוצגו למסעדות שדורשות כשרות.</p>
      )}
      {differentCount > 0 && (
        <p className="text-muted">
          {differentCount === 1 ? "מוצר אחד מסומן" : `${differentCount} מוצרים מסומנים`} בכשרות משלו, והסימון הזה לא
          משנה אותם.
        </p>
      )}
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
