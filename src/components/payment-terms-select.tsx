import { PAYMENT_TERM_OPTIONS, paymentTermsLabel } from "@/lib/terms";

/** תנאי תשלום ללקוח מסוים, בתשובה של הספק (לא חובה) */
export function PaymentTermsSelect({ defaultValue }: { defaultValue: number | null }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">תנאי תשלום ללקוח הזה (לא חובה)</span>
      <select
        name="paymentTerms"
        defaultValue={defaultValue === null ? "" : String(defaultValue)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-base outline-none focus:border-accent"
      >
        <option value="">לא לציין</option>
        {PAYMENT_TERM_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {paymentTermsLabel(d)}
          </option>
        ))}
      </select>
    </label>
  );
}
