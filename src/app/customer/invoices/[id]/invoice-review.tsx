"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import type { Confidence } from "@/lib/invoices/read";
import { basketFromInvoice } from "../actions";

export interface ReviewLine {
  text: string;
  productId: string;
  suggested: boolean;
  quantity: string;
  price: string;
  confidence: Confidence;
  note: string | null;
  included: boolean;
}

interface CatalogOption {
  id: string;
  name: string;
  unit: string;
  category: string;
}

const CONFIDENCE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "נקרא בבירור", className: "bg-accent-soft text-accent" },
  medium: { label: "כדאי לבדוק", className: "bg-[#fff4c2] text-[#6b5300]" },
  low: { label: "צריך לבדוק", className: "bg-[#ffe0b3] text-[#7a3d00]" },
};

export function InvoiceReview({
  invoiceId,
  lines: initial,
  catalog,
  initialSupplierName,
  supplierNames,
}: {
  invoiceId: string;
  lines: ReviewLine[];
  catalog: CatalogOption[];
  initialSupplierName: string;
  supplierNames: string[];
}) {
  const [state, action, pending] = useActionState(basketFromInvoice, {});
  const [lines, setLines] = useState(initial);
  const [perMonth, setPerMonth] = useState("4");
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const groups = useMemo(() => {
    const map = new Map<string, CatalogOption[]>();
    for (const p of catalog) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map];
  }, [catalog]);

  const update = (i: number, patch: Partial<ReviewLine>) =>
    setLines((current) => current.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const included = lines.filter((l) => l.included);
  const invoiceTotal = included.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);
  const factor = Number(perMonth) || 0;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
        <Field label="הספק שהוציא את החשבונית">
          <Input name="supplierName" defaultValue={initialSupplierName} list="invoice-suppliers" maxLength={80} />
        </Field>
        <datalist id="invoice-suppliers">
          {supplierNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <Field label="שם לסל">
          <Input
            name="name"
            defaultValue={initialSupplierName ? `החשבונית מ${initialSupplierName}` : "סל מחשבונית"}
            required
            maxLength={60}
          />
        </Field>
        <Field label="כמה חשבוניות כאלה מגיעות בחודש?">
          <Input
            name="invoicesPerMonth"
            type="number"
            inputMode="decimal"
            min={0.25}
            max={31}
            step="any"
            value={perMonth}
            onChange={(e) => setPerMonth(e.target.value)}
            required
          />
        </Field>
        <Field label="היקף הרכש החודשי שלכם מהספק הזה (לא חובה)">
          <Select name="volume" defaultValue="">
            <option value="">לפי הסל</option>
            {VOLUME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted sm:col-span-2">
          הכמות החודשית בסל = הכמות בחשבונית × מספר החשבוניות בחודש. לדוגמה, חשבונית שבועית = 4.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {lines.map((l, i) => {
          const product = byId.get(l.productId);
          const unit = product ? UNIT_LABEL[product.unit as keyof typeof UNIT_LABEL] : "";
          const flag = l.confidence !== "high";
          return (
            <li
              key={i}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${l.included ? (flag ? "border-[#e0b400] bg-[#fffbe6]" : "border-border bg-surface") : "border-dashed border-border bg-background opacity-70"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={l.included}
                    onChange={(e) => update(i, { included: e.target.checked })}
                    className="mt-1 size-4"
                    aria-label={`לכלול את השורה ${l.text}`}
                  />
                  <span>
                    <span className="block text-xs text-muted">בחשבונית:</span>
                    <span className="font-medium">{l.text}</span>
                  </span>
                </label>
                <span className={`rounded px-2 py-0.5 text-xs ${CONFIDENCE[l.confidence].className}`}>
                  {CONFIDENCE[l.confidence].label}
                </span>
              </div>
              {l.note && <p className="text-xs text-[#6b5300]">{l.note}</p>}
              {l.included && (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] [&_input]:w-full [&_input]:min-w-0 [&_select]:w-full [&_select]:min-w-0">
                  <input type="hidden" name="line" value={i} />
                  <Field label="המוצר בקטלוג">
                    <Select
                      name={`product_${i}`}
                      value={l.productId}
                      onChange={(e) => update(i, { productId: e.target.value, suggested: false })}
                      required
                    >
                      <option value="">בחרו מוצר…</option>
                      {groups.map(([category, items]) => (
                        <optgroup key={category} label={category}>
                          {items.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label={`כמות בחשבונית${unit ? ` (${unit})` : ""}`}>
                    <Input
                      name={`quantity_${i}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={`מחיר ליחידה ₪${unit ? ` (ל${unit})` : ""}`}>
                    <Input
                      name={`price_${i}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={l.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {included.length} מתוך {lines.length} שורות בסל · סה״כ בחשבונית{" "}
          <span className="font-semibold">{shekels(Math.round(invoiceTotal * 100))}</span>
          {factor > 0 && (
            <>
              {" "}
              · בחודש בערך <span className="font-semibold">{shekels(Math.round(invoiceTotal * factor * 100))}</span>
            </>
          )}
        </p>
        <div className="flex flex-col gap-1">
          <FormError message={state.error} />
          <SubmitButton pending={pending || included.length === 0}>
            {pending ? "משווים…" : "השוואת המחירים"}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
