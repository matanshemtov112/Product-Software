"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { shekels } from "@/lib/format";
import { VALID_DAYS } from "@/lib/matches";
import { respondMatch } from "../../actions";

export interface RespondLine {
  id: string;
  productName: string;
  unitLabel: string;
  monthlyQuantity: number;
  currentPriceAgorot: number;
  targetPriceAgorot: number;
  response: "PENDING" | "MATCHED" | "COUNTER" | "DECLINED";
  counterPriceAgorot: number | null;
  /** הלקוח כבר החליט על השורה, ואי אפשר לשנות אותה */
  locked: boolean;
}

function LineRow({ line }: { line: RespondLine }) {
  const [response, setResponse] = useState<RespondLine["response"]>(
    line.response === "PENDING" ? "MATCHED" : line.response,
  );
  const saving = (price: number) => Math.max(0, Math.round((line.currentPriceAgorot - price) * line.monthlyQuantity));
  const radio = (value: string, label: string) => (
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name={`response_${line.id}`}
        value={value}
        checked={response === value}
        onChange={() => setResponse(value as RespondLine["response"])}
        disabled={line.locked}
        className="accent-accent"
      />
      {label}
    </label>
  );
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{line.productName}</p>
          <p className="text-xs text-muted">
            {line.monthlyQuantity} {line.unitLabel} בחודש
          </p>
        </div>
        <p className="text-sm sm:text-end">
          הלקוח משלם לכם {shekels(line.currentPriceAgorot, 2)} · מצא{" "}
          <strong>{shekels(line.targetPriceAgorot, 2)}</strong> ל{line.unitLabel}
          <span className="block text-xs text-muted">
            השוואה תחסוך ללקוח {shekels(saving(line.targetPriceAgorot))} בחודש
          </span>
        </p>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" disabled={line.locked}>
        <legend className="sr-only">התשובה ל{line.productName}</legend>
        {radio("MATCHED", `משווה ל-${shekels(line.targetPriceAgorot, 2)}`)}
        {radio("COUNTER", "מחיר אחר")}
        {response === "COUNTER" && (
          <label className="flex items-center gap-2">
            <span className="sr-only">המחיר שלכם ל{line.productName}</span>₪
            <input
              name={`counter_${line.id}`}
              inputMode="decimal"
              defaultValue={line.counterPriceAgorot ? (line.counterPriceAgorot / 100).toFixed(2) : ""}
              placeholder={(line.targetPriceAgorot / 100).toFixed(2)}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-base outline-none focus:border-accent"
              required
            />
            ל{line.unitLabel}
          </label>
        )}
        {radio("DECLINED", "לא נוכל")}
        {line.locked && <span className="text-xs text-muted">הלקוח כבר החליט על המוצר הזה</span>}
      </fieldset>
    </li>
  );
}

export function RespondForm({
  requestId,
  lines,
  note,
  answered,
}: {
  requestId: string;
  lines: RespondLine[];
  note: string | null;
  answered: boolean;
}) {
  const [state, action, pending] = useActionState(respondMatch, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <LineRow key={l.id} line={l} />
        ))}
      </ul>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">ההצעה בתוקף למשך</span>
        <select
          name="validDays"
          defaultValue="30"
          className="rounded-md border border-border bg-surface px-2 py-1 text-base outline-none focus:border-accent"
        >
          {VALID_DAYS.map((d) => (
            <option key={d} value={d}>
              {d} ימים
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">הודעה ללקוח (לא חובה)</span>
        <textarea
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={note ?? ""}
          placeholder="למשל: המחירים בתוקף מההזמנה הבאה, בהתחייבות לשלושה חודשים."
          className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{answered ? "עדכון התשובה" : "שליחת התשובה ללקוח"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
