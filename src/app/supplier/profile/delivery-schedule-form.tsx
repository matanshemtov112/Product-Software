"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { MAX_DELIVERIES_PER_WEEK, timesPerWeekText } from "@/lib/terms";
import { saveDeliverySchedule } from "../actions";

/** בחירה איך הלקוחות רואים כמה פעמים בשבוע הספק מגיע: ימים קבועים לפי אזור, או מספר פעמים בשבוע */
export function DeliveryScheduleForm({
  initial,
  areas,
}: {
  initial: { schedule: "BY_AREA" | "PER_WEEK" | null; perWeek: number | null };
  /** האזורים והימים שלהם, כפי שהלקוח באזור יראה */
  areas: { label: string; text: string | null }[];
}) {
  const [state, action, pending] = useActionState(saveDeliverySchedule, {});
  const [mode, setMode] = useState<"BY_AREA" | "PER_WEEK">(initial.schedule ?? "BY_AREA");
  const missing = areas.filter((a) => !a.text).length;
  return (
    <ActionForm action={action} className="flex flex-col gap-3 text-sm">
      <p className="text-muted">הלקוחות יראו ליד כל הצעה שלכם כמה פעמים בשבוע אתם מגיעים אליהם. בחרו דרך אחת:</p>
      <label className="flex items-start gap-2">
        <input
          type="radio"
          name="schedule"
          value="BY_AREA"
          checked={mode === "BY_AREA"}
          onChange={() => setMode("BY_AREA")}
          className="mt-1 accent-accent"
        />
        <span>
          <span className="font-medium">ימים קבועים לפי אזור</span>
          <span className="block text-muted">לכל אזור חלוקה במפה בוחרים באילו ימים מגיעים, למשל א׳, ג׳ ו-ה׳.</span>
        </span>
      </label>
      {mode === "BY_AREA" && (
        <div className="ms-6 flex flex-col gap-1 rounded-md bg-sand p-3">
          {areas.length === 0 ? (
            <p className="text-muted">עדיין לא סימנתם אזורי חלוקה.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {areas.map((a) => (
                <li key={a.label}>
                  <span className="font-medium">{a.label}:</span>{" "}
                  {a.text ?? <span className="text-accent">לא נבחרו ימים</span>}
                </li>
              ))}
            </ul>
          )}
          {missing > 0 && (
            <p className="text-xs text-muted">באזור בלי ימים הלקוחות יראו &quot;הספק עוד לא ציין ימי חלוקה&quot;.</p>
          )}
          <Link href="/supplier/areas" className="self-start font-medium text-accent hover:underline">
            בחירת הימים לכל אזור במפה ←
          </Link>
        </div>
      )}
      <label className="flex items-start gap-2">
        <input
          type="radio"
          name="schedule"
          value="PER_WEEK"
          checked={mode === "PER_WEEK"}
          onChange={() => setMode("PER_WEEK")}
          className="mt-1 accent-accent"
        />
        <span>
          <span className="font-medium">מספר פעמים בשבוע</span>
          <span className="block text-muted">בלי ימים קבועים. אותו מספר לכל האזורים.</span>
        </span>
      </label>
      {mode === "PER_WEEK" && (
        <div className="ms-6 flex flex-wrap gap-2" role="radiogroup" aria-label="כמה פעמים בשבוע">
          {Array.from({ length: MAX_DELIVERIES_PER_WEEK }, (_, i) => i + 1).map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 has-checked:border-accent has-checked:bg-accent-soft has-checked:font-medium"
            >
              <input
                type="radio"
                name="perWeek"
                value={n}
                defaultChecked={initial.perWeek === n || (!initial.perWeek && n === 2)}
                className="sr-only"
              />
              {timesPerWeekText(n)}
            </label>
          ))}
        </div>
      )}
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-good">
          נשמר. הלקוחות רואים את זה מעכשיו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>שמירת ימי החלוקה</SubmitButton>
      </div>
    </ActionForm>
  );
}
