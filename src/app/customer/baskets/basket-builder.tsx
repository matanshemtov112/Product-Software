"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { UNIT_LABEL } from "@/lib/format";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { normalize, searchItems } from "@/lib/search";
import { saveBasket } from "../actions";

export interface CatalogItem {
  id: string;
  name: string;
  unit: keyof typeof UNIT_LABEL;
  category: string;
  parentCategory?: string;
  /** שמות נוספים: נרדפים, השמות שספקים נותנים למוצר ומותגים */
  aliases?: string[];
  /** בסל לפי ספק נוכחי: השם של הספק למוצר */
  supplierName?: string;
  /** איך המוצר מגיע אצל הספק והמינימום להזמנה (רק במחירון של ספק) */
  pack?: string;
  minOrder?: string;
  packPrice?: string;
}

const searchFields = (p: CatalogItem) => ({
  name: p.name,
  aliases: p.aliases,
  categories: [p.category, p.parentCategory].filter((c): c is string => Boolean(c)),
});

const MAX_RESULTS = 20;

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
  initialSupplierName = "",
  supplierNames = [],
  submitLabel,
}: {
  basketId?: string;
  source: "MANUAL" | "CURRENT_SUPPLIER" | "TEMPLATE" | "INVOICE";
  currentSupplier?: { id: string; name: string };
  catalog: CatalogItem[];
  initialRows: BuilderRow[];
  initialName: string;
  initialDeliveries: number;
  /** מפתח מ-VOLUME_RANGES, או "" כשלא נבחר */
  initialVolume: string;
  /** שם הספק שהלקוח עובד איתו היום, כפי שכתב אותו */
  initialSupplierName?: string;
  /** שמות הספקים במערכת, להשלמה אוטומטית של שם הספק הנוכחי */
  supplierNames?: string[];
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveBasket, {});
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const checklist = source === "CURRENT_SUPPLIER";

  const update = (productId: string, patch: Partial<BuilderRow>) =>
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));
  const remove = (productId: string) => setRows((prev) => prev.filter((r) => r.productId !== productId));
  const add = (productIds: string[]) => {
    setRows((prev) => [
      ...prev,
      ...productIds
        .filter((id) => !prev.some((r) => r.productId === id))
        .map((productId) => ({ productId, quantity: "", price: "", included: true })),
    ]);
    setSearch("");
  };
  const onSearch = (value: string) => {
    const match = catalog.find((p) => p.name === value);
    if (match) add([match.id]);
    else setSearch(value);
  };

  const available = catalog.filter((p) => !rows.some((r) => r.productId === p.id));
  // חיפוש בקטלוג: גם בשמות שספקים נותנים למוצר, בשמות נרדפים ובקטגוריה ("שמן" מוצא את כל השמנים)
  const results = normalize(search) ? searchItems(available, search, searchFields) : [];
  // בסל לפי ספק נוכחי: סינון המוצרים של הספק; שורות מוסתרות עדיין נשלחות עם הטופס
  const visible = new Set((filter ? searchItems(catalog, filter, searchFields) : catalog).map((p) => p.id));
  const filteredOut = rows.filter((r) => !visible.has(r.productId)).length;
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
          <Input
            name="deliveriesPerMonth"
            type="number"
            min="1"
            max="31"
            defaultValue={initialDeliveries}
            dir="ltr"
            required
          />
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

      {!checklist && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-4">
          <Field label="הספק שאתם עובדים איתו היום (לא חובה)">
            <Input
              name="currentSupplierName"
              list="current-suppliers"
              defaultValue={initialSupplierName}
              maxLength={80}
              placeholder="למשל: הירקן של משה"
            />
          </Field>
          <datalist id="current-suppliers">
            {supplierNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className="text-xs text-muted">
            מלאו את שם הספק ואת המחיר שאתם משלמים לו היום בכל מוצר, ונראה לכם איפה יש במערכת מחיר טוב יותר. שם הספק שלכם
            לא נחשף לספקים אחרים.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{checklist ? `המוצרים מהקטלוג של ${currentSupplier?.name}` : "המוצרים בסל"}</h2>
          <span className="text-sm text-muted">
            {included} מוצרים{checklist ? " נבחרו" : ""} · כמות לחודש · מחיר ללא מע״מ
          </span>
        </div>
        {checklist && (
          <>
            <p className="text-sm text-muted">
              סמנו את המוצרים שאתם קונים מהספק ומלאו כמה אתם צורכים בחודש. המחיר מולא לפי המחירון של הספק; אם אתם משלמים
              מחיר אחר, עדכנו אותו.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`חיפוש בקטלוג של ${currentSupplier?.name ?? "הספק"}, למשל "שמן"`}
                aria-label="חיפוש בקטלוג של הספק"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              />
              {filter && (
                <span className="text-sm text-muted">
                  {rows.length - filteredOut} מוצרים מתאימים
                  {rows.length - filteredOut > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => prev.map((r) => (visible.has(r.productId) ? { ...r, included: true } : r)))
                      }
                      className="ms-2 text-accent hover:underline"
                    >
                      סימון כולם
                    </button>
                  )}
                </span>
              )}
            </div>
          </>
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
                  hidden={!visible.has(r.productId)}
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
                      <span className="block text-xs text-muted">
                        {p.supplierName && p.supplierName !== p.name ? `אצל הספק: ${p.supplierName} · ` : ""}
                        {p.category}
                        {p.packPrice ? ` · ${p.packPrice}` : p.pack && ` · ${p.pack}`}
                        {p.minOrder && ` · מינימום ${p.minOrder}`}
                      </span>
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
                        required={r.included && visible.has(r.productId)}
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
              placeholder='+ הוספת מוצר: חיפוש בקטלוג, למשל "שמן" או השם אצל הספק שלכם'
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
            {normalize(search) && (
              <div className="rounded-lg border border-border bg-surface p-2" aria-live="polite">
                {results.length === 0 ? (
                  <p className="p-2 text-sm text-muted">לא מצאנו מוצר בשם הזה בקטלוג.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 text-sm">
                      <span className="text-muted">{results.length} מוצרים מתאימים</span>
                      {results.length > 1 && (
                        <button
                          type="button"
                          onClick={() => add(results.slice(0, MAX_RESULTS).map((p) => p.id))}
                          className="text-accent hover:underline"
                        >
                          הוספת כולם לסל
                        </button>
                      )}
                    </div>
                    <ul className="divide-y divide-border">
                      {results.slice(0, MAX_RESULTS).map((p) => {
                        // כשהמוצר נמצא בזכות שם אחר, מראים באיזה שם
                        const nameHit = normalize(p.name).includes(normalize(search))
                          ? undefined
                          : (p.aliases ?? []).find((a) => normalize(a).includes(normalize(search)));
                        return (
                          <li key={p.id} className="flex items-center justify-between gap-3 px-2 py-2">
                            <span className="min-w-0">
                              <span className="block font-medium">{p.name}</span>
                              <span className="block text-xs text-muted">
                                {nameHit ? `נקרא גם: ${nameHit} · ` : ""}
                                {p.category}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => add([p.id])}
                              className="shrink-0 rounded-md border border-border px-3 py-1 text-sm hover:bg-background"
                              aria-label={`הוספת ${p.name} לסל`}
                            >
                              + הוספה
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted">
          המחיר שאתם משלמים היום (ליחידה, ללא מע״מ) לא חובה. בכל מוצר שתמלאו נראה אם יש במערכת מחיר טוב יותר וכמה תחסכו
          בחודש.
        </p>
      </div>

      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
