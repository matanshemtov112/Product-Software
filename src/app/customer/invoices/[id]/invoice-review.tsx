"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { monthlyFromUsage, WEEKS_PER_MONTH, type UsagePeriod } from "@/lib/invoices/basket";
import type { Confidence } from "@/lib/invoices/read";
import { ageText, FRESH_DAYS, invoiceAge, todayInIsrael } from "@/lib/invoices/age";
import { basketFromInvoice } from "../actions";
import { QuantityInput } from "@/components/quantity-input";
import { ProductPicker, type PickerOption } from "./product-picker";

export interface ReviewLine {
  text: string;
  productId: string;
  suggested: boolean;
  quantity: string;
  price: string;
  confidence: Confidence;
  note: string | null;
  included: boolean;
  /** המותג שזוהה בשורה; ריק כשלא זוהה */
  brand: string;
  /** להשוות רק למותג הזה (ברירת מחדל כשזוהה מותג) */
  brandOnly?: boolean;
  /** הצריכה שהלקוח ממלא בעצמו, כשבחר להעתיק רק את המוצרים */
  usage?: string;
  /** הנחה שהודפסה בשורה; המחיר כבר אחריה */
  lineDiscountPct?: number;
}

type CatalogOption = PickerOption;

const QTY_INPUT =
  "min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent";

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
  initialDate,
  initialDiscount,
}: {
  /** הנחה כללית שזוהתה בחשבונית (%) */
  initialDiscount: number;
  /** תאריך החשבונית כפי שנקרא (YYYY-MM-DD), או null כשלא זוהה */
  initialDate: string | null;
  invoiceId: string;
  lines: ReviewLine[];
  catalog: CatalogOption[];
  initialSupplierName: string;
  supplierNames: string[];
}) {
  const [state, action, pending] = useActionState(basketFromInvoice, {});
  const [lines, setLines] = useState(initial);
  const [perMonth, setPerMonth] = useState("4");
  const [discount, setDiscount] = useState(initialDiscount ? String(initialDiscount) : "");
  const pct = Math.min(90, Math.max(0, Number(discount) || 0));
  const net = (price: string) => (Number(price) || 0) * (1 - pct / 100);
  const [date, setDate] = useState(initialDate ?? "");
  const [oldPrices, setOldPrices] = useState<"" | "keep" | "drop">("");
  const today = todayInIsrael();
  const age = invoiceAge(date, today);
  const pricesUsed = age.kind === "fresh" || (age.kind === "old" && oldPrices === "keep");
  const [mode, setMode] = useState<"invoice" | "own">("invoice");
  const [period, setPeriod] = useState<UsagePeriod>("week");
  const own = mode === "own";
  const periodWord = period === "week" ? "לשבוע" : "לחודש";
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  const update = (i: number, patch: Partial<ReviewLine>) =>
    setLines((current) => current.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const included = lines.filter((l) => l.included);
  const invoiceTotal = included.reduce((sum, l) => sum + (Number(l.quantity) || 0) * net(l.price), 0);
  const factor = Number(perMonth) || 0;
  // במצב "הצריכה שלי": עלות חודשית לפי הצריכה שמולאה והמחיר מהחשבונית
  const ownMonthly = included.reduce(
    (sum, l) => sum + monthlyFromUsage(Number(l.usage) || 0, period) * net(l.price),
    0,
  );
  const ownMissing = own ? included.filter((l) => !(Number(l.usage) > 0)).length : 0;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="quantityMode" value={mode} />
      {age.kind === "old" && oldPrices && <input type="hidden" name="oldPrices" value={oldPrices} />}
      <section
        aria-label="תאריך החשבונית"
        className={`flex flex-col gap-3 rounded-lg border p-5 ${
          age.kind === "fresh"
            ? "border-border bg-surface"
            : age.kind === "old" || age.kind === "unknown"
              ? "border-[#e0b400] bg-[#fffbe6]"
              : "border-danger bg-[#fdecec]"
        }`}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="תאריך החשבונית">
            <Input
              name="invoiceDate"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-44"
            />
          </Field>
          <p className="pb-2 text-sm">
            {age.kind === "unknown"
              ? initialDate
                ? "נא לבדוק את התאריך."
                : "לא הצלחנו לקרוא את התאריך מהחשבונית. נא למלא אותו."
              : age.kind === "future"
                ? "התאריך בעתיד. בדקו שהוא נכון."
                : `החשבונית ${ageText(age)}.${initialDate && date === initialDate ? " זה התאריך שקראנו, אפשר לתקן." : ""}`}
          </p>
        </div>
        {age.kind === "fresh" && <p className="text-sm text-muted">חשבונית עדכנית: נשווה את הסל מול המחירים שבה.</p>}
        {age.kind === "old" && (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              החשבונית ישנה מ-{FRESH_DAYS} יום. ייתכן שהמחירים אצל הספק השתנו מאז, וההשוואה מול מחירים ישנים יכולה
              להראות חיסכון שלא באמת קיים. האם אתם עדיין משלמים את המחירים שבחשבונית?
            </p>
            <div role="radiogroup" aria-label="המחירים בחשבונית" className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              {(
                [
                  ["keep", "כן, אלה המחירים שאני משלם היום"],
                  ["drop", "לא בטוח, להשוות בלי המחירים מהחשבונית"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="oldPricesChoice"
                    checked={oldPrices === value}
                    onChange={() => setOldPrices(value)}
                    required
                    className="accent-accent"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        {age.kind === "too_old" && (
          <p className="text-sm">
            החשבונית ישנה מדי (יותר משנה). נשתמש רק ברשימת המוצרים ובכמויות, בלי המחירים שבה. כדי לראות כמה תחסכו מול מה
            שאתם משלמים היום, העלו חשבונית מהחודשים האחרונים.
          </p>
        )}
      </section>
      <input type="hidden" name="usagePeriod" value={period} />
      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 font-semibold">איך לבנות את הסל מהחשבונית?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["invoice", "להעתיק את הכמויות מהחשבונית", "הסל יקבל את המוצרים ואת הכמויות כפי שהם בחשבונית."],
              [
                "own",
                "רק רשימת המוצרים, את הכמויות אמלא בעצמי",
                "מתאים כשהחשבונית לא מייצגת את הצריכה הרגילה. ממלאים כמה צורכים בשבוע או בחודש מכל מוצר.",
              ],
            ] as const
          ).map(([value, title, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${mode === value ? "border-accent bg-accent-soft" : "border-border"}`}
            >
              <input
                type="radio"
                name="quantityModeChoice"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-1 accent-accent"
              />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {own && (
          <div role="radiogroup" aria-label="הצריכה שאתם ממלאים" className="flex flex-wrap items-center gap-3 text-sm">
            <span>הכמויות שאמלא הן:</span>
            {(
              [
                ["week", "צריכה שבועית"],
                ["month", "צריכה חודשית"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="usagePeriodChoice"
                  checked={period === value}
                  onChange={() => setPeriod(value)}
                  className="accent-accent"
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
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
        <Field label={own ? "כמה הזמנות בחודש אתם עושים מהספק?" : "כמה חשבוניות כאלה מגיעות בחודש?"}>
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
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Field label="הנחה כללית על כל החשבונית, באחוזים (אם יש)">
            <Input
              name="discountPct"
              type="number"
              inputMode="decimal"
              min={0}
              max={90}
              step="any"
              value={discount}
              placeholder="0"
              onChange={(e) => setDiscount(e.target.value)}
              className="w-32"
            />
          </Field>
          <p className="text-xs text-muted">
            {initialDiscount > 0
              ? `זיהינו בחשבונית הנחה כללית של ${initialDiscount}%. `
              : "לא זיהינו הנחה כללית בחשבונית. אם יש לכם הנחה קבועה מהספק, כתבו אותה כאן. "}
            {pct > 0
              ? `נוריד ${pct}% מהמחיר של כל מוצר, כדי שההשוואה תהיה מול מה שאתם באמת משלמים.`
              : "המחירים יושוו כפי שהם בשורות."}
          </p>
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          {own
            ? period === "week"
              ? `הכמות החודשית בסל = הצריכה השבועית × ${WEEKS_PER_MONTH}. מספר ההזמנות עוזר לבדוק את המינימום להזמנה אצל כל ספק.`
              : "הכמות החודשית בסל = הצריכה החודשית שתמלאו. מספר ההזמנות עוזר לבדוק את המינימום להזמנה אצל כל ספק."
            : "הכמות החודשית בסל = הכמות בחשבונית × מספר החשבוניות בחודש. לדוגמה, חשבונית שבועית = 4."}
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
                    <ProductPicker
                      name={`product_${i}`}
                      value={l.productId}
                      options={catalog}
                      onChange={(id) => update(i, { productId: id, suggested: false })}
                    />
                  </Field>
                  {own ? (
                    <Field label={`צריכה ${periodWord}${unit ? ` (${unit})` : ""}`}>
                      <QuantityInput
                        name={`usage_${i}`}
                        value={l.usage ?? ""}
                        placeholder={`בחשבונית: ${l.quantity}`}
                        preferred={[Number(l.quantity)]}
                        onValue={(v) => update(i, { usage: v })}
                        aria-label={`צריכה ${periodWord} של ${l.text}`}
                        inputClassName={QTY_INPUT}
                        wrapperClassName="flex w-full items-center gap-1"
                        required
                      />
                    </Field>
                  ) : (
                    <Field label={`כמות בחשבונית${unit ? ` (${unit})` : ""}`}>
                      <QuantityInput
                        name={`quantity_${i}`}
                        value={l.quantity}
                        preferred={[Number(initial[i]?.quantity)]}
                        onValue={(v) => update(i, { quantity: v })}
                        aria-label={`כמות בחשבונית של ${l.text}`}
                        inputClassName={QTY_INPUT}
                        wrapperClassName="flex w-full items-center gap-1"
                        required
                      />
                    </Field>
                  )}
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
                    {pct > 0 && Number(l.price) > 0 && (
                      <span className="text-xs text-accent">
                        אחרי ההנחה: {shekels(Math.round(net(l.price) * 100), 2)}
                      </span>
                    )}
                    {l.lineDiscountPct ? (
                      <span className="text-xs text-muted">כולל הנחה של {l.lineDiscountPct}% שמופיעה בשורה</span>
                    ) : null}
                  </Field>
                </div>
              )}
              {l.included && l.brand.trim() !== "" && (
                <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
                  <legend className="px-1 text-xs text-muted">מותג</legend>
                  <label className="flex flex-wrap items-center gap-2">
                    <span>בחשבונית כתוב מותג:</span>
                    <input
                      name={`brand_${i}`}
                      value={l.brand}
                      onChange={(e) => update(i, { brand: e.target.value })}
                      maxLength={40}
                      aria-label="המותג שזוהה בחשבונית"
                      className="w-32 rounded-md border border-border bg-surface px-2 py-1"
                    />
                  </label>
                  <input type="hidden" name={`brandOnly_${i}`} value={l.brandOnly !== false ? "1" : "0"} />
                  <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`brandChoice_${i}`}
                        checked={l.brandOnly !== false}
                        onChange={() => update(i, { brandOnly: true })}
                        className="accent-accent"
                      />
                      להשוות רק ל{l.brand.trim()}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`brandChoice_${i}`}
                        checked={l.brandOnly === false}
                        onChange={() => update(i, { brandOnly: false })}
                        className="accent-accent"
                      />
                      להשוות גם למותגים אחרים
                    </label>
                  </div>
                  <p className="text-xs text-muted">
                    גם אם תבחרו רק {l.brand.trim()}, נראה לכם בדף הסל אם יש מוצר דומה ממותג אחר שזול יותר.
                  </p>
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {included.length} מתוך {lines.length} שורות בסל
          {own ? (
            ownMissing > 0 ? (
              <> · חסרה צריכה {ownMissing === 1 ? "למוצר אחד" : `ל-${ownMissing} מוצרים`}</>
            ) : (
              <>
                {" "}
                · לפי מחירי החשבונית, בחודש בערך{" "}
                <span className="font-semibold">{shekels(Math.round(ownMonthly * 100))}</span>
              </>
            )
          ) : (
            <>
              {" "}
              · סה״כ בחשבונית <span className="font-semibold">{shekels(Math.round(invoiceTotal * 100))}</span>
            </>
          )}
          {!own && factor > 0 && (
            <>
              {" "}
              · בחודש בערך <span className="font-semibold">{shekels(Math.round(invoiceTotal * factor * 100))}</span>
            </>
          )}
        </p>
        <div className="flex flex-col gap-1">
          {!pricesUsed && (age.kind === "old" || age.kind === "too_old") && (
            <p className="text-xs text-muted">המחירים מהחשבונית לא יישמרו בסל</p>
          )}
          <FormError message={state.error} />
          <SubmitButton pending={pending || included.length === 0 || age.kind === "future"}>
            {pending ? "משווים…" : "השוואת המחירים"}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
