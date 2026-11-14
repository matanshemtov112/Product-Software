import type { ReactNode } from "react";
import { OfferBadge } from "@/components/offer-badge";
import type { OfferStage } from "@/lib/offer-status";

type ServerAction = (form: FormData) => Promise<void>;

/** הסטטוס של ההצעה עם הסבר קצר, ומתחתיו הפעולות שמותר לעשות עכשיו */
export function OfferStatus({ stage, note, children }: { stage: OfferStage; note: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">סטטוס ההצעה:</span>
        <OfferBadge stage={stage} />
        <span>{note}</span>
      </p>
      {children && <div className="flex flex-wrap items-start gap-3">{children}</div>}
    </div>
  );
}

const hiddenInputs = (fields: Record<string, string>) =>
  Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

/** כפתור פעולה בלחיצה אחת */
export function OfferButton({
  action,
  fields,
  label,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  label: string;
}) {
  return (
    <form action={action}>
      {hiddenInputs(fields)}
      <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">{label}</button>
    </form>
  );
}

/** פעולה עם סיבה לא חובה (דחייה או ביטול): נפתחת בלחיצה כדי שלא תקרה בטעות */
export function OfferReasonAction({
  action,
  fields,
  label,
  confirm,
  placeholder,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  label: string;
  confirm: string;
  placeholder: string;
}) {
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer list-none rounded-md border border-border bg-surface px-4 py-2 group-open:border-danger">
        {label}
      </summary>
      <form action={action} className="mt-2 flex w-72 max-w-full flex-col gap-2">
        {hiddenInputs(fields)}
        <textarea
          name="note"
          rows={2}
          maxLength={300}
          placeholder={placeholder}
          aria-label="סיבה (לא חובה)"
          className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        <button className="rounded-md bg-danger px-4 py-2 font-medium text-white">{confirm}</button>
      </form>
    </details>
  );
}
