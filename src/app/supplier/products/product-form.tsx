"use client";

import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { PACK_LABEL, type PackTypeKey } from "@/lib/pack";
import { saveOffer } from "../actions";
import { ImageField } from "./image-field";

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
  supplierProductName: string;
  packType: PackTypeKey | "";
  packSize: number;
  packSizeMax: number | null;
  minQuantity: number;
  minPacks: number | null;
  available: boolean;
  /** מחיר בשקלים לפי מזהה מדרגה */
  prices: Record<string, string>;
  imageSrc: string | null;
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
  /** סוגי מוצר לבחירה, מקובצים לפי תחום ראשי */
  categories: { group: string; options: { id: string; name: string }[] }[];
  catalog: CatalogProduct[];
  tiers: { id: string; name: string; minMonthlyAgorot: number }[];
}) {
  const [state, action, pending] = useActionState(saveOffer, {});
  const editing = Boolean(initial.offerId);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [unit, setUnit] = useState(initial.unit);
  const [packType, setPackType] = useState(initial.packType);
  const unitLabel = UNITS.find((u) => u.value === unit)?.label ?? "";

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
              {categories.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="יחידת מכירה">
            <Select
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof unit)}
              disabled={editing}
            >
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
          <Field label="השם שלכם למוצר, כמו בחשבונית (לא חובה)">
            <Input
              name="supplierProductName"
              defaultValue={initial.supplierProductName}
              maxLength={80}
              placeholder="למשל: קנולה פח 18 ל׳"
            />
          </Field>
          <Field label="מותג (לא חובה)">
            <Input name="brand" defaultValue={initial.brand} />
          </Field>
          <Field label='מק"ט אצלכם (לא חובה)'>
            <Input name="supplierSku" defaultValue={initial.supplierSku} dir="ltr" />
          </Field>
          <Field label="איך המוצר מגיע">
            <Select name="packType" value={packType} onChange={(e) => setPackType(e.target.value as PackTypeKey | "")}>
              <option value="">{`בתפזורת, לפי ${unitLabel}`}</option>
              {Object.entries(PACK_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              {packType ? `כמה ${unitLabel} ב${PACK_LABEL[packType]}` : `גודל אריזה (${unitLabel})`}
            </span>
            <div className="flex items-center gap-2 [&_input]:w-full [&_input]:min-w-0">
              <Input
                name="packSize"
                type="number"
                step="any"
                min="0"
                defaultValue={initial.packSize}
                dir="ltr"
                required
                aria-label="גודל אריזה"
              />
              <span className="text-muted">עד</span>
              <Input
                name="packSizeMax"
                type="number"
                step="any"
                min="0"
                defaultValue={initial.packSizeMax ?? ""}
                dir="ltr"
                placeholder="משקל משתנה"
                aria-label="גודל אריזה מקסימלי"
              />
            </div>
            <span className="text-xs text-muted">במשקל משתנה, למשל קרטון של 15 עד 20 ק״ג. אחרת השאירו ריק.</span>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted">כמות מינימלית להזמנה (לא חובה)</span>
            <div className="flex items-center gap-2 [&_input]:w-full [&_input]:min-w-0">
              <Input
                name="minAmount"
                type="number"
                step="any"
                min="0"
                defaultValue={initial.minPacks ?? (initial.minQuantity || "")}
                dir="ltr"
                aria-label="כמות מינימלית"
              />
              <Select
                name="minIn"
                defaultValue={initial.minPacks ? "packs" : "units"}
                aria-label="יחידת הכמות המינימלית"
              >
                <option value="units">{unitLabel}</option>
                <option value="packs">{packType ? PACK_LABEL[packType] : "אריזות"}</option>
              </Select>
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="available" defaultChecked={initial.available} className="size-4 accent-accent" />
          זמין להזמנה
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">תמונה (לא חובה)</legend>
        <ImageField currentSrc={initial.imageSrc} />
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
        <p className="text-xs text-muted">
          שינוי של יותר מ-30% ממחיר קיים ייכנס להשוואות רק אחרי אישור צוות הפלטפורמה.
        </p>
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
