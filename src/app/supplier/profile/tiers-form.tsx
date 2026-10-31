"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { MAX_TIERS } from "@/lib/supplier/tiers";
import { saveTiers } from "../actions";

interface Row {
  key: string;
  id: string;
  name: string;
  min: string;
}

const input =
  "min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function TiersForm({ initial }: { initial: { id: string; name: string; min: number }[] }) {
  const [state, action, pending] = useActionState(saveTiers, {});
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length
      ? initial.map((t) => ({ key: t.id, id: t.id, name: t.name, min: String(t.min) }))
      : [{ key: "new-0", id: "", name: "רגיל", min: "0" }],
  );
  const removed = initial.filter((t) => !rows.some((r) => r.id === t.id));
  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        כל מדרגה חלה מהיקף הרכש החודשי שהלקוח קונה אצלכם. מחירים לכל מדרגה מזינים בעריכת המוצר. במדרגה בלי מחיר, הלקוח
        מקבל את המחיר של המדרגה שמתחתיה.
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
            <input type="hidden" name="tierId" value={r.id} />
            <input
              name="tierName"
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              aria-label={`שם מדרגה ${i + 1}`}
              placeholder="שם המדרגה"
              maxLength={30}
              className={input}
              required
            />
            <label className="flex min-w-0 items-center gap-1 text-sm">
              <span className="shrink-0 text-muted">מ-₪</span>
              <input
                name="tierMin"
                value={r.min}
                onChange={(e) => update(r.key, { min: e.target.value })}
                aria-label={`מאיזה היקף חודשי, מדרגה ${i + 1}`}
                inputMode="numeric"
                dir="ltr"
                className={`${input} w-full`}
                readOnly={i === 0}
                required
              />
            </label>
            {i === 0 ? (
              <span className="w-14 text-xs text-muted">בסיס</span>
            ) : (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="w-14 text-sm text-danger hover:underline"
              >
                הסרה
              </button>
            )}
          </li>
        ))}
      </ul>
      {rows.length < MAX_TIERS && (
        <div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { key: `new-${Date.now()}`, id: "", name: "", min: "" }])}
            className="text-sm text-accent hover:underline"
          >
            + הוספת מדרגה
          </button>
        </div>
      )}
      {removed.length > 0 && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm">
          המחירים שהזנתם במדרגות {removed.map((t) => `"${t.name}"`).join(", ")} יימחקו בשמירה.
        </p>
      )}
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          המדרגות נשמרו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>שמירת המדרגות</SubmitButton>
      </div>
    </ActionForm>
  );
}
