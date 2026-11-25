"use client";

import { useId, type InputHTMLAttributes } from "react";

const COMMON = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];

/** רשימת הכמויות לבחירה: הכמות שכדאי להציע קודם (למשל מהחשבונית), ואחריה כמויות נפוצות */
export function quantityChoices(preferred: number[] = []): number[] {
  const first = preferred.filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n * 100) / 100);
  return [...new Set([...first, ...COMMON])];
}

/** צעד אחד למעלה או למטה: שלמים, ובכמויות קטנות מ-1 חצי */
export function stepQuantity(value: string, direction: 1 | -1): string {
  const n = Number(value) || 0;
  const step = (n > 0 && n < 1) || (n === 1 && direction === -1) ? 0.5 : 1;
  const next = Math.max(0, Math.round((n + direction * step) * 100) / 100);
  return next ? String(next) : "";
}

/**
 * שדה כמות: מקלידים כל מספר, או בוחרים מרשימה (נפתחת בלחיצה על השדה), או מוסיפים ומורידים בכפתורים.
 */
export function QuantityInput({
  value,
  onValue,
  preferred,
  inputClassName = "w-20 rounded-md border border-border bg-surface px-2 py-1.5 outline-none focus:border-accent",
  wrapperClassName = "inline-flex items-center gap-1",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValue: (value: string) => void;
  /** כמויות להציע קודם ברשימה */
  preferred?: number[];
  inputClassName?: string;
  wrapperClassName?: string;
}) {
  const listId = useId();
  const label = props["aria-label"] ?? "כמות";
  // השדה ראשון ב-DOM, כדי שלחיצה על התווית תתמקד בו ולא בכפתור; הסדר על המסך נקבע ב-order
  const button =
    "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-lg leading-none hover:bg-background disabled:opacity-40";
  return (
    <span className={wrapperClassName}>
      <input
        {...props}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        list={listId}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className={`order-2 ${inputClassName}`}
        dir="ltr"
      />
      <button
        type="button"
        className={button}
        onClick={() => onValue(stepQuantity(value, -1))}
        tabIndex={-1}
        disabled={props.disabled || !(Number(value) > 0)}
        aria-label={`הפחתה: ${label}`}
        style={{ order: 3 }}
      >
        −
      </button>
      <button
        type="button"
        className={button}
        onClick={() => onValue(stepQuantity(value, 1))}
        tabIndex={-1}
        disabled={props.disabled}
        aria-label={`הוספה: ${label}`}
        style={{ order: 1 }}
      >
        +
      </button>
      <datalist id={listId}>
        {quantityChoices(preferred).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </span>
  );
}
