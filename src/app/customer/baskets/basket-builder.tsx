"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { UNIT_LABEL } from "@/lib/format";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { saveBasket } from "../actions";

export interface CatalogItem {
  id: string;
  name: string;
  unit: keyof typeof UNIT_LABEL;
  category: string;
}

export interface BuilderRow {
  productId: string;
  quantity: string;
  /** המחיר ליחידה שהלקוח משלם היום, בשקלים; ריק אם לא ידוע */
  price: string;
  included: boolean;
}

/**
 * בניית סל: מוצרים, כמות חודשית ומחיר נוכחי.
 * במצב "ספק נוכחי" הרשימה היא הקטלוג של הספק עם תיבות סימון; בשאר המצבים מוסיפים ומורידים מוצרים מהקטלוג.
 */
export function BasketBuilder({
  basketId,
  source,
  currentSupplier,
  catalog,
  initialRows,
  initialName,
  initialDeliveries,
  initialVolume,
  submitLabel,
}: {
  basketId?: string;
  source: "MANUAL" | "CURRENT_SUPPLIER" | "TEMPLATE";
  currentSupplier?: { id: string; name: string };
  catalog: CatalogItem[];
  initialRows: BuilderRow[];
  initialName: string;
  initialDeliveries: number;
  /** מפתח מ-VOLUME_RANGES, או "" כשלא נבחר */
  initialVolume: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveBasket, {});
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const checklist = source === "CURRENT_SUPPLIER";

  const update = (productId: string, patch: Partial<BuilderRow>) =>
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));
  const remove = (productId: string) => setRows((prev) => prev.filter((r) => r.productId !== productId));
  const add = (productId: string) => {
    if (rows.some((r) => r.productId === productId)) return;
    setRows((prev) => [...prev, { productId, quantity: "", price: "", included: true }]);
    setSearch("");
  };
  const onSearch = (value: string) => {
    const match = catalog.find((p) => p.name === value);
    if (match) add(match.id);
    else setSearch(value);
  };

  const available = catalog.filter((p) => !rows.some((r) => r.productId === p.id));
  const included = rows.filter((r) => r.included).length;

  return (
    <ActionForm action={action} className="flex flex-col gap-5">
      {basketId && <input type="hidden" name="basketId" value={basketId} />}
      <input type="hidden" name="source" value={source} />
      {currentSupplier && <input type="hidden" name="currentSupplierId" value={currentSupplier.id} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="שם הסל">
          <Input name="name" defaultValue={initialName} required maxLength={60} />
        </Field>
        <Field label="כמה אספקות בחודש">
          <Input name="deliveriesPerMonth" type="number" min="1" max="31" defaultValue={initialDeliveries} dir="ltr" required />
        </Field>
        <Field label="היקף הרכש החודשי שלכם (₪, ללא מע״מ)">
          <select
            name="volume"
            defaultValue={initialVolume}
            className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">רק הסל הזה</option>
            {VOLUME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted">
        ספקים נותנים מחיר טוב יותר ללקוח שקונה יותר. אם הסל הוא רק חלק מהקניות החודשיות שלכם, בחרו את ההיקף הכולל ונחשב
        לפיו את מדרגת המחיר אצל כל ספק.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {checklist ? `המוצרים מהקטלוג של ${currentSupplier?.name}` : "המוצרים בסל"}
          </h2>
          <span className="text-sm text-muted">
            {included} מוצרים{checklist ? " נבחרו" : ""} · כמות לחודש · מחיר ללא מע״מ
          </span>
        </div>
        {checklist && (
          <p className="text-sm text-muted">
            סמנו את המוצרים שאתם קונים מהספק ומלאו כמה אתם צורכים בחודש. המחיר מולא לפי המחירון של הספק; אם אתם משלמים
            מחיר אחר, עדכנו אותו.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            עוד אין מוצרים. חפשו מוצר למטה כדי להוסיף.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => {
              const p = byId.get(r.productId);
              if (!p) return null;
              const unit = UNIT_LABEL[p.unit];
              return (
                <li
                  key={r.productId}
                  className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 ${r.included ? "" : "opacity-60"}`}
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    {checklist && (
                      <input
                        type="checkbox"
                        checked={r.included}
                        onChange={(e) => update(r.productId, { included: e.target.checked })}
                        className="size-4 shrink-0 accent-accent"
                        aria-label={`קונים ${p.name}`}
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{p.category}</span>
                    </span>
                  </label>
                  {r.included && <input type="hidden" name="productId" value={r.productId} />}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        name={r.included ? `quantity_${r.productId}` : undefined}
                        type="number"
                        min="0"
                        step="any"
                        value={r.quantity}
                        onChange={(e) => update(r.productId, { quantity: e.target.value, included: true })}
                        disabled={!r.included && !checklist}
                        required={r.included}
                        aria-label={`כמות חודשית של ${p.name}`}
                        className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 outline-none focus:border-accent"
                        dir="ltr"
                      />
                      <span className="w-12 text-muted">{unit}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted">₪</span>
                      <input
                        name={r.included ? `price_${r.productId}` : undefined}
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.price}
                        onChange={(e) => update(r.productId, { price: e.target.value })}
                        placeholder="מחיר היום"
                        aria-label={`המחיר שאתם משלמים היום ל${unit} ${p.name}`}
                        className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 outline-none focus:border-accent"
                        dir="ltr"
                      />
                    </label>
                    {!checklist && (
                      <button
                        type="button"
                        onClick={() => remove(r.productId)}
                        className="px-2 text-sm text-danger hover:underline"
                        aria-label={`הסרת ${p.name}`}
                      >
                        הסרה
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!checklist && (
          <div className="flex flex-col gap-1">
            <input
              list="basket-catalog"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="+ הוספת מוצר: חיפוש בקטלוג"
              aria-label="הוספת מוצר מהקטלוג"
              className="rounded-md border border-dashed border-border bg-surface px-3 py-2 outline-none focus:border-accent"
            />
            <datalist id="basket-catalog">
              {available.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.category}
                </option>
              ))}
            </datalist>
          </div>
        )}
        <p className="text-xs text-muted">
          המחיר שאתם משלמים היום לא חובה. אם תמלאו אותו לכל המוצרים, נחשב כמה תחסכו בחודש.
        </p>
      </div>

      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
