"use client";

import { ActionForm } from "@/components/action-form";
import { listUrl } from "@/lib/supplier/list-return";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/form";
import { shekels } from "@/lib/format";
import { nominalPackSize, PACK_LABEL, packContent, type PackTypeKey } from "@/lib/pack";
import { saveOffer } from "../actions";
import { ImageField } from "./image-field";

interface CatalogProduct {
  name: string;
  categoryId: string;
  unit: "KG" | "LITER" | "UNIT";
}

export interface OfferFormValues {
  offerId?: string;
  /** אריזה נוספת למוצר שכבר ברשימה: המוצר קבוע, ממלאים רק אריזה ומחיר */
  addPack?: boolean;
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
  /** הספק מזין מחיר לאריזה ולא ליחידה */
  pricePerPack: boolean;
  available: boolean;
  /** מחיר בשקלים לפי מזהה מדרגה */
  prices: Record<string, string>;
  imageSrc: string | null;
  /** סוג המחיר הרגיל הנוכחי: קבוע או עם תוקף */
  priceType?: "FIXED" | "UNTIL";
  /** היום האחרון שהמחיר הרגיל בתוקף, yyyy-mm-dd */
  validUntil?: string;
  /** מבצע בתוקף, בשקלים לפי מדרגה */
  promoPrices?: Record<string, string>;
  promoUntil?: string;
  /** מבצע כמות קיים */
  deal?: {
    min: string;
    minIn: "units" | "packs";
    type: "pct" | "price";
    value: string;
    until: string;
  } | null;
}

type PriceType = "FIXED" | "UNTIL" | "PROMOTION";

const PRICE_TYPES: { value: PriceType; label: string; hint: string }[] = [
  { value: "FIXED", label: "מחיר קבוע", hint: "בלי תאריך סיום. הלקוחות רואים מתי עדכנתם אותו." },
  {
    value: "UNTIL",
    label: "מחיר עם תוקף",
    hint: "אתם מתחייבים למחיר עד תאריך. אחריו המוצר יוצא מההשוואות עד שתעדכנו מחיר.",
  },
  {
    value: "PROMOTION",
    label: "מבצע",
    hint: "מחיר מוזל עד תאריך. המחיר הרגיל נשאר שמור וחוזר אוטומטית כשהמבצע נגמר.",
  },
];

const dateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  back,
}: {
  initial: OfferFormValues;
  /** הרשימה שממנה הגיעו (חיפוש ותצוגה), כדי לחזור לאותו מקום אחרי שמירה */
  back?: string;
  /** סוגי מוצר לבחירה, מקובצים לפי תחום ראשי */
  categories: { group: string; options: { id: string; name: string }[] }[];
  catalog: CatalogProduct[];
  tiers: { id: string; name: string; minMonthlyAgorot: number }[];
}) {
  const [state, action, pending] = useActionState(saveOffer, {});
  const editing = Boolean(initial.offerId);
  const productLocked = editing || Boolean(initial.addPack);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [unit, setUnit] = useState(initial.unit);
  const [packType, setPackType] = useState(initial.packType);
  const unitLabel = UNITS.find((u) => u.value === unit)?.label ?? "";
  const [packSize, setPackSize] = useState(String(initial.packSize));
  const [packSizeMax, setPackSizeMax] = useState(initial.packSizeMax ? String(initial.packSizeMax) : "");
  const [pricePer, setPricePer] = useState<"unit" | "pack">(initial.pricePerPack ? "pack" : "unit");
  const [priceType, setPriceType] = useState<PriceType>(initial.priceType ?? "FIXED");
  const promotion = priceType === "PROMOTION";
  const [regularPrices, setRegularPrices] = useState(initial.prices);
  const [promoPrices, setPromoPrices] = useState(initial.promoPrices ?? {});
  const [validUntil, setValidUntil] = useState(initial.validUntil ?? "");
  const [promoUntil, setPromoUntil] = useState(initial.promoUntil ?? "");
  const prices = promotion ? promoPrices : regularPrices;
  const setPrices = promotion ? setPromoPrices : setRegularPrices;
  const [dealOn, setDealOn] = useState(Boolean(initial.deal));
  const [dealType, setDealType] = useState<"pct" | "price">(initial.deal?.type ?? "pct");
  const today = new Date();
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const pack = { unit, packSize: Number(packSize) || 0, packSizeMax: Number(packSizeMax) || null };
  const nominal = nominalPackSize(pack);
  // במשקל משתנה אין מחיר קבוע לאריזה: המחיר תמיד ליחידת המידה
  const variable = Boolean(pack.packSizeMax && pack.packSizeMax > pack.packSize);
  const effectivePricePer = variable ? "unit" : pricePer;
  const packName = packType ? PACK_LABEL[packType] : "אריזה";
  const packText = pack.packSize > 0 ? `${packName} ${packContent(pack)}` : packName;
  // המחיר המקביל: ליחידה כשמזינים לאריזה, ולאריזה כשמזינים ליחידה
  const converted = (value: string | undefined) => {
    const n = Number(value);
    if (!value || !(n > 0) || !(nominal > 0)) return null;
    const agorot = Math.round(n * 100);
    return effectivePricePer === "pack"
      ? `= ${shekels(Math.round(agorot / nominal), 2)} ל${unitLabel}${pack.packSizeMax ? " (לפי משקל ממוצע)" : ""}`
      : `= ${shekels(Math.round(agorot * nominal), 2)} ל${packText}`;
  };

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
      {back && <input type="hidden" name="back" value={back} />}
      {initial.addPack && (
        <>
          <input type="hidden" name="categoryId" value={initial.categoryId} />
          <input type="hidden" name="unit" value={initial.unit} />
        </>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-semibold">המוצר</legend>
        <Field label="שם המוצר">
          <Input
            name="productName"
            list="catalog-products"
            defaultValue={initial.productName}
            readOnly={productLocked}
            onChange={(e) => onProductName(e.target.value)}
            required
          />
        </Field>
        <datalist id="catalog-products">
          {catalog.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
        {!productLocked && (
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
              disabled={productLocked}
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
              disabled={productLocked}
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
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
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
                value={packSizeMax}
                onChange={(e) => setPackSizeMax(e.target.value)}
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
        <legend className="mb-2 font-semibold">מחיר, ללא מע״מ</legend>
        <div role="radiogroup" aria-label="המחיר שאתם מזינים" className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["unit", `מחיר ל${unitLabel}`],
              ["pack", `מחיר ל${packText}`],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 ${effectivePricePer === value ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
            >
              <input
                type="radio"
                name="pricePer"
                value={value}
                checked={effectivePricePer === value}
                disabled={value === "pack" && variable}
                onChange={() => setPricePer(value)}
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          מוצר שקיל (כמו אנטריקוט) מתמחרים ל{unitLabel}, והלקוח יראה רק את המחיר ל{unitLabel}. מוצר במחיר קומפלט (כמו פח
          שמן) מתמחרים לאריזה, והלקוח יראה את המחיר לאריזה וגם את המחיר ל{unitLabel}.
          {variable && " במשקל משתנה המחיר הוא תמיד ל" + unitLabel + "."}
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">סוג המחיר</span>
          <div role="radiogroup" aria-label="סוג המחיר" className="flex flex-wrap gap-2 text-sm">
            {PRICE_TYPES.filter((t) => t.value !== "PROMOTION" || editing).map((t) => (
              <label
                key={t.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 ${priceType === t.value ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="priceType"
                  value={t.value}
                  checked={priceType === t.value}
                  onChange={() => setPriceType(t.value)}
                  className="accent-accent"
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">{PRICE_TYPES.find((t) => t.value === priceType)?.hint}</p>
          {priceType !== "FIXED" && (
            <Field label={promotion ? "המבצע בתוקף עד (כולל)" : "המחיר בתוקף עד (כולל)"}>
              <Input
                name="validUntil"
                type="date"
                value={promotion ? promoUntil : validUntil}
                onChange={(e) => (promotion ? setPromoUntil : setValidUntil)(e.target.value)}
                min={dateInput(today)}
                max={dateInput(maxDate)}
                required
                dir="ltr"
                className="sm:max-w-48"
              />
            </Field>
          )}
          {promotion && (
            <p className="text-xs text-muted">
              מלאו מחיר מבצע למדרגות שבהן יש מבצע. מדרגה שתשאירו ריקה תישאר במחיר הרגיל.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(tiers.length ? tiers : [{ id: "new", name: "רגיל", minMonthlyAgorot: 0 }]).map((t, i) => (
            <Field
              key={t.id}
              label={`${promotion ? "מבצע · " : ""}${t.name}${t.minMonthlyAgorot ? ` (מ-₪${(t.minMonthlyAgorot / 100).toLocaleString("he-IL")} בחודש)` : ""}${i === 0 && !promotion ? " *" : ""}`}
            >
              <Input
                name={`price_${t.id}`}
                type="number"
                step="0.01"
                min="0"
                value={prices[t.id] ?? ""}
                onChange={(e) => setPrices((current) => ({ ...current, [t.id]: e.target.value }))}
                dir="ltr"
                required={i === 0 && !promotion}
              />
              {promotion && regularPrices[t.id] && (
                <span className="text-xs text-muted">מחיר רגיל: ₪{regularPrices[t.id]}</span>
              )}
              {converted(prices[t.id]) && <span className="text-xs text-muted">{converted(prices[t.id])}</span>}
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted">
          שינוי של יותר מ-30% ממחיר קיים ייכנס להשוואות רק אחרי אישור צוות הפלטפורמה.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">מבצע כמות (לא חובה)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="dealEnabled"
            checked={dealOn}
            onChange={(e) => setDealOn(e.target.checked)}
            className="size-4 accent-accent"
          />
          הנחה למי שמזמין כמות גדולה בהזמנה אחת
        </label>
        {dealOn && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted">מאיזו כמות בהזמנה</span>
              <div className="flex items-center gap-2 [&_input]:w-full [&_input]:min-w-0">
                <Input
                  name="dealMin"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={initial.deal?.min ?? ""}
                  dir="ltr"
                  required
                  aria-label="כמות מינימלית למבצע"
                />
                <Select name="dealMinIn" defaultValue={initial.deal?.minIn ?? "units"} aria-label="יחידת הכמות">
                  <option value="units">{unitLabel}</option>
                  <option value="packs">{packType ? PACK_LABEL[packType] : "אריזות"}</option>
                </Select>
              </div>
              <span className="text-xs text-muted">למשל 100 פחים, או משטח שלם.</span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted">מה מקבלים</span>
              <div className="flex items-center gap-2 [&_input]:w-full [&_input]:min-w-0">
                <Select
                  name="dealType"
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as "pct" | "price")}
                  aria-label="סוג ההנחה"
                >
                  <option value="pct">אחוז הנחה</option>
                  <option value="price">{`מחיר ל${effectivePricePer === "pack" ? packText : unitLabel}`}</option>
                </Select>
                <Input
                  name="dealValue"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial.deal?.value ?? ""}
                  dir="ltr"
                  required
                  aria-label={dealType === "pct" ? "אחוז הנחה" : "מחיר במבצע"}
                />
                <span className="text-muted">{dealType === "pct" ? "%" : "₪"}</span>
              </div>
            </div>
            <Field label="בתוקף עד (לא חובה)">
              <Input
                name="dealUntil"
                type="date"
                defaultValue={initial.deal?.until ?? ""}
                min={dateInput(today)}
                max={dateInput(maxDate)}
                dir="ltr"
              />
            </Field>
            <p className="text-xs text-muted sm:col-span-2">
              הכמות נבדקת לכל הזמנה. לקוחות שמזמינים מספיק יקבלו את המחיר בהשוואה, וכל הלקוחות באזורי המשלוח שלכם יראו
              את המבצע בדף המבצעים ויוכלו לשלוח לכם פנייה.
            </p>
          </div>
        )}
      </fieldset>

      <FormError message={state.error} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>{editing ? "שמירת שינויים" : "הוספת המוצר"}</SubmitButton>
        <Link
          href={editing ? listUrl(back, initial.offerId) : listUrl(back)}
          className="text-sm text-muted hover:text-foreground"
        >
          ביטול
        </Link>
      </div>
    </ActionForm>
  );
}
