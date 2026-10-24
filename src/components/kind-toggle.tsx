"use client";

export type AccountKind = "customer" | "supplier";

const LABELS: Record<AccountKind, string> = { customer: "מסעדה / עסק", supplier: "ספק" };

/** בחירה בין חשבון מסעדה לחשבון ספק; שולחת את הבחירה בשדה kind */
export function KindToggle({
  value,
  onChange,
  prefix = "",
}: {
  value: AccountKind;
  onChange: (kind: AccountKind) => void;
  prefix?: string;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {(["customer", "supplier"] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`rounded-md border px-3 py-2 ${value === k ? "border-accent bg-accent-soft font-medium" : "border-border"}`}
        >
          {prefix}
          {LABELS[k]}
        </button>
      ))}
      <input type="hidden" name="kind" value={value} />
    </div>
  );
}
