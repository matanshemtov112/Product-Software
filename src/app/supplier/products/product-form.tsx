"use client";

import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { saveOffer } from "../actions";

interface CatalogProduct {
  name: string;
  categoryId: string;
  unit: "KG" | "LITER" | "UNIT";
}

export interface OfferFormValues {
  offerId?: string;
  productName: string;
  categoryId: string;
  unit: "KG" | "LITER" | "UNIT";
  brand: string;
  supplierSku: string;
  packSize: number;
  minQuantity: number;
  available: boolean;
  /** מחיר בשקלים לפי מזהה מדרגה */
  prices: Record<string, string>;
}

const UNITS = [
  { value: "KG", label: "ק״ג" },
  { value: "LITER", label: "ליטר" },
  { value: "UNIT", label: "יחידה" },
] as const;

export function ProductForm({
  initial,
  categories,
  catalog,
  tiers,
}: {
  initial: OfferFormValues;
  categories: { id: string; name: string }[];
  catalog: CatalogProduct[];
  tiers: { id: string; name: string; minMonthlyAgorot: number }[];
}) {
  const [state, action, pending] = useActionState(saveOffer, {});
  const editing = Boolean(initial.offerId);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [unit, setUnit] = useState(initial.unit);

  // בחירת מוצר קיים מהקטלוג ממלאת את סוג המוצר והיחידה שלו
  const onProductName = (name: string) => {
    const match = catalog.find((p) => p.name === name);
    if (match) {
      setCategoryId(match.categoryId);
      setUnit(match.unit);
    }
  };

  return (
    <ActionForm action={action} className="flex flex-col gap-5">
      {editing && <input type="hidden" name="offerId" value={initial.offerId} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-semibold">המוצר</legend>
        <Field label="שם המוצר">
          <Input
            name="productName"
            list="catalog-products"
            defaultValue={initial.productName}
            readOnly={editing}
            onChange={(e) => onProductName(e.target.value)}
            required
          />
        </Field>
        <datalist id="catalog-products">
          {catalog.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
        {!editing && (
          <p className="-mt-2 text-xs text-muted">
            כדאי לבחור שם מהרשימה. מוצר בשם חדש ייבדק על ידי צוות הפלטפורמה כדי שיושווה נכון מול ספקים אחרים.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="סוג מוצר">
            <Select
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={editing}
              required
            >
              <option value="" disabled>
                בחירה
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="יחידת מכירה">
            <Select name="unit" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} disabled={editing}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          {editing && (
            <>
              <input type="hidden" name="categoryId" value={categoryId} />
              <input type="hidden" name="unit" value={unit} />
            </>
          )}
          <Field label="מותג (לא חובה)">
            <Input name="brand" defaultValue={initial.brand} />
          </Field>
          <Field label='מק"ט אצלכם (לא חובה)'>
            <Input name="supplierSku" defaultValue={initial.supplierSku} dir="ltr" />
          </Field>
          <Field label={`גודל אריזה (${UNITS.find((u) => u.value === unit)?.label})`}>
            <Input name="packSize" type="number" step="any" min="0" defaultValue={initial.packSize} dir="ltr" required />
          </Field>
          <Field label="כמות מינימלית להזמנה">
            <Input name="minQuantity" type="number" step="any" min="0" defaultValue={initial.minQuantity} dir="ltr" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="available" defaultChecked={initial.available} className="size-4 accent-accent" />
          זמין להזמנה
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">מחיר ליחידה, ללא מע״מ</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(tiers.length ? tiers : [{ id: "new", name: "רגיל", minMonthlyAgorot: 0 }]).map((t, i) => (
            <Field
              key={t.id}
              label={`${t.name}${t.minMonthlyAgorot ? ` (מ-₪${(t.minMonthlyAgorot / 100).toLocaleString("he-IL")} בחודש)` : ""}${i === 0 ? " *" : ""}`}
            >
              <Input
                name={`price_${t.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial.prices[t.id] ?? ""}
                dir="ltr"
                required={i === 0}
              />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted">שינוי של יותר מ-30% ממחיר קיים ייכנס להשוואות רק אחרי אישור צוות הפלטפורמה.</p>
      </fieldset>

      <FormError message={state.error} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>{editing ? "שמירת שינויים" : "הוספת המוצר"}</SubmitButton>
        <Link href="/supplier" className="text-sm text-muted hover:text-foreground">
          ביטול
        </Link>
      </div>
    </ActionForm>
  );
}
