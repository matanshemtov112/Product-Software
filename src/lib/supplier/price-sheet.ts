import { UNIT_LABEL } from "@/lib/format";
import { nominalPackSize, packLabel, type PackInfo } from "@/lib/pack";

/**
 * מחירון באקסל: הספק מוריד את המחירון שלו כקובץ, מעדכן מחירים באקסל ומעלה אותו בחזרה.
 * הקובץ מזוהה לפי שמות העמודות (לא לפי הסדר), וכל שורה מותאמת למוצר לפי המזהה, המק״ט, הברקוד או השם.
 * כאן רק הלוגיקה בלי מסד הנתונים, כדי שאפשר יהיה לבדוק אותה.
 */

export const MAX_SHEET_ROWS = 2000;
export const MAX_SHEET_BYTES = 1024 * 1024;

export type Cell = string | number | boolean | Date | null | undefined;

export interface SheetTier {
  id: string;
  name: string;
  minMonthlyAgorot: number;
}

type SheetPack = Pick<PackInfo, "unit" | "packType" | "packSize" | "packSizeMax"> & { pricePerPack: boolean };

export interface SheetOffer extends SheetPack {
  id: string;
  productName: string;
  supplierProductName: string | null;
  brand: string | null;
  supplierSku: string | null;
  barcode: string | null;
  available: boolean;
  /** המחיר הרגיל שבתוקף עכשיו, ליחידת בסיס, לפי מזהה מדרגה */
  prices: Record<string, number>;
}

const COLUMN = {
  id: "מזהה (לא לשנות)",
  product: "שם המוצר",
  supplierName: "השם שלכם",
  brand: "מותג",
  sku: "מק״ט",
  barcode: "ברקוד",
  pack: "אריזה",
  per: "המחיר הוא ל",
  available: "זמין",
} as const;

/** כותרת עמודת המחיר של מדרגה */
export function priceColumn(tier: SheetTier, tiers: SheetTier[]): string {
  return tiers.length === 1 ? "מחיר ללא מע״מ" : `מחיר ${tier.name}`;
}

const perLabel = (o: SheetPack) => (o.pricePerPack ? "אריזה" : UNIT_LABEL[o.unit]);

/** המחיר כפי שהספק רואה אותו בקובץ: לאריזה או ליחידת בסיס, באגורות */
export function sheetAgorot(o: SheetPack, unitAgorot: number): number {
  return o.pricePerPack ? Math.round(unitAgorot * nominalPackSize(o)) : unitAgorot;
}

/** ערך שמתחיל בסימן של נוסחה נכתב כטקסט, כדי שאקסל לא יריץ אותו */
function csvCell(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** המחירון כקובץ CSV שאקסל פותח בעברית (עם BOM) */
export function priceListCsv(offers: SheetOffer[], tiers: SheetTier[]): string {
  const header = [
    COLUMN.id,
    COLUMN.product,
    COLUMN.supplierName,
    COLUMN.brand,
    COLUMN.sku,
    COLUMN.barcode,
    COLUMN.pack,
    COLUMN.per,
    ...tiers.map((t) => priceColumn(t, tiers)),
    COLUMN.available,
  ];
  const rows = offers.map((o) => [
    o.id,
    o.productName,
    o.supplierProductName,
    o.brand,
    o.supplierSku,
    o.barcode,
    packLabel(o),
    perLabel(o),
    ...tiers.map((t) => (o.prices[t.id] === undefined ? null : (sheetAgorot(o, o.prices[t.id]) / 100).toFixed(2))),
    o.available ? "כן" : "לא",
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** פענוח CSV (פסיק, נקודה-פסיק או טאב), כולל ערכים במירכאות */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** טקסט של קובץ CSV: UTF-8, ואם לא נקרא נכון, הקידוד העברי הישן של אקסל */
export function decodeCsv(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1255").decode(bytes);
  } catch {
    return utf8;
  }
}

const norm = (s: string) => s.replace(/["'״׳`\s()_\-]/g, "").toLowerCase();

/** ערך תא כטקסט נקי */
export function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "number") return String(c);
  return String(c).trim().replace(/^'/, "");
}

/** מחיר מתא: מספר, או טקסט כמו "34.90", "₪ 34.90" או "34,90"; null לריק, NaN ללא תקין */
export function cellAgorot(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) && c > 0 ? Math.round(c * 100) : Number.NaN;
  const s = cellText(c).replace(/[₪\s]/g, "");
  if (s === "") return null;
  const normalized = /^\d+,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : Number.NaN;
}

function availableOf(c: Cell): boolean | null | "bad" {
  if (typeof c === "boolean") return c;
  const s = norm(cellText(c));
  if (s === "") return null;
  if (["כן", "v", "✓", "1", "yes", "true", "זמין"].includes(s)) return true;
  if (["לא", "x", "0", "no", "false", "לאזמין", "חסר"].includes(s)) return false;
  return "bad";
}

export interface SheetColumns {
  id?: number;
  product?: number;
  supplierName?: number;
  sku?: number;
  barcode?: number;
  available?: number;
  /** עמודת מחיר לכל מדרגה */
  prices: Map<string, number>;
}

/** מוצא את שורת הכותרות (באחת מ-5 השורות הראשונות) ואת העמודות */
export function findColumns(rows: Cell[][], tiers: SheetTier[]): { headerRow: number; columns: SheetColumns } | null {
  const aliases: [keyof Omit<SheetColumns, "prices">, string[]][] = [
    ["id", [COLUMN.id, "מזהה", "id"]],
    ["product", [COLUMN.product, "מוצר", "שםמוצר", "product"]],
    ["supplierName", [COLUMN.supplierName, "שםאצלכם", "תיאור"]],
    ["sku", [COLUMN.sku, "מקט", "sku", "קודפריט", "מספרפריט"]],
    ["barcode", [COLUMN.barcode, "barcode", "ean"]],
    ["available", [COLUMN.available, "במלאי", "available"]],
  ];
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const heads = rows[r].map((c) => norm(cellText(c)));
    const columns: SheetColumns = { prices: new Map() };
    for (const [key, names] of aliases) {
      const i = heads.findIndex((h) => names.some((n) => norm(n) === h));
      if (i >= 0) columns[key] = i;
    }
    for (const t of tiers) {
      const wanted = [priceColumn(t, tiers), `מחיר ${t.name}`, ...(tiers.length === 1 ? ["מחיר", "price"] : [])].map(
        norm,
      );
      const i = heads.findIndex((h) => wanted.includes(h));
      if (i >= 0) columns.prices.set(t.id, i);
    }
    // בלי עמודת מחיר במדרגה הראשונה אבל עם עמודה אחת בשם "מחיר": שייכת למדרגה הבסיסית
    if (!columns.prices.has(tiers[0]?.id ?? "")) {
      const i = heads.findIndex((h) => h === norm("מחיר") || h === norm("מחיר ללא מע״מ"));
      if (i >= 0 && tiers[0]) columns.prices.set(tiers[0].id, i);
    }
    const identifies =
      columns.id !== undefined ||
      columns.sku !== undefined ||
      columns.barcode !== undefined ||
      columns.product !== undefined ||
      columns.supplierName !== undefined;
    if (identifies && (columns.prices.size > 0 || columns.available !== undefined)) return { headerRow: r, columns };
  }
  return null;
}

export interface PriceChange {
  tierId: string;
  tierName: string;
  /** ליחידת בסיס, באגורות; null = לא היה מחיר */
  fromAgorot: number | null;
  toAgorot: number;
  /** כפי שמוצג בקובץ (לאריזה או ליחידה) */
  fromSheet: number | null;
  toSheet: number;
  /** שינוי של יותר מ-30%: ימתין לאישור צוות הפלטפורמה */
  needsApproval: boolean;
}

export interface PreviewRow {
  /** מספר השורה בקובץ (כמו באקסל) */
  line: number;
  offerId?: string;
  label: string;
  /** "ק״ג" / "אריזה": למה המחיר בקובץ */
  per?: string;
  changes: PriceChange[];
  available?: boolean;
  error?: string;
}

export interface Preview {
  rows: PreviewRow[];
  /** שורות שהותאמו בלי שום שינוי */
  unchanged: number;
  /** מוצרים ברשימה שלא הופיעו בקובץ (לא משתנים) */
  missing: number;
}

/**
 * משווה את הקובץ למחירון הנוכחי. מחזיר רק שורות עם שינוי או עם שגיאה.
 * @param approval פונקציה שמחליטה אם שינוי מחיר ממתין לאישור (כמו בעריכה רגילה)
 */
export function previewSheet(
  rows: Cell[][],
  offers: SheetOffer[],
  tiers: SheetTier[],
  approval: (from: number | null, to: number) => boolean,
): Preview | { error: string } {
  if (rows.length === 0) return { error: "הקובץ ריק" };
  const found = findColumns(rows, tiers);
  if (!found) {
    return {
      error:
        "לא מצאנו בקובץ את העמודות. הכי פשוט: הורידו את המחירון שלכם מהכפתור למעלה, עדכנו בו את המחירים, ושמרו בלי לשנות את הכותרות.",
    };
  }
  const { headerRow, columns } = found;
  const body = rows.slice(headerRow + 1);
  if (body.length > MAX_SHEET_ROWS) return { error: `אפשר להעלות עד ${MAX_SHEET_ROWS} שורות בקובץ אחד` };

  const byId = new Map(offers.map((o) => [o.id, o]));
  const unique = (key: (o: SheetOffer) => string[]) => {
    const map = new Map<string, SheetOffer | "many">();
    for (const o of offers) {
      for (const k of new Set(key(o).map(norm).filter(Boolean))) map.set(k, map.has(k) ? "many" : o);
    }
    return map;
  };
  const bySku = unique((o) => [o.supplierSku ?? ""]);
  const byBarcode = unique((o) => [o.barcode ?? ""]);
  const byName = unique((o) => [o.productName, o.supplierProductName ?? ""]);

  const seen = new Set<string>();
  const out: PreviewRow[] = [];
  let unchanged = 0;
  body.forEach((cells, i) => {
    const line = headerRow + i + 2;
    const get = (c?: number) => (c === undefined ? "" : cellText(cells[c]));
    const name = get(columns.supplierName) || get(columns.product);
    const label = name || get(columns.sku) || get(columns.barcode) || `שורה ${line}`;
    if (cells.every((c) => cellText(c) === "")) return;

    let offer: SheetOffer | "many" | undefined;
    const id = get(columns.id);
    if (id) offer = byId.get(id);
    if (!offer && get(columns.sku)) offer = bySku.get(norm(get(columns.sku)));
    if (!offer && get(columns.barcode)) offer = byBarcode.get(norm(get(columns.barcode)));
    if (!offer) {
      for (const n of [get(columns.supplierName), get(columns.product)]) {
        if (!offer && n) offer = byName.get(norm(n));
      }
    }
    if (offer === "many") {
      out.push({
        line,
        label,
        changes: [],
        error: "יש לכם כמה אריזות של המוצר הזה. כדי לדעת איזו, צריך את המק״ט או את עמודת המזהה",
      });
      return;
    }
    if (!offer) {
      out.push({ line, label, changes: [], error: "לא מצאנו את המוצר ברשימה שלכם. מוצר חדש מוסיפים מעמוד המוצרים" });
      return;
    }
    const itemLabel = `${offer.supplierProductName || offer.productName} · ${packLabel(offer)}`;
    if (seen.has(offer.id)) {
      out.push({
        line,
        offerId: offer.id,
        label: itemLabel,
        changes: [],
        error: "המוצר הזה כבר מופיע בשורה קודמת בקובץ",
      });
      return;
    }
    seen.add(offer.id);

    const changes: PriceChange[] = [];
    let bad: string | undefined;
    for (const t of tiers) {
      const col = columns.prices.get(t.id);
      if (col === undefined) continue;
      const entered = cellAgorot(cells[col]);
      if (entered === null) continue;
      if (Number.isNaN(entered)) {
        bad = `המחיר "${cellText(cells[col])}" לא תקין`;
        break;
      }
      const from = offer.prices[t.id] ?? null;
      const fromSheet = from === null ? null : sheetAgorot(offer, from);
      if (fromSheet === entered) continue;
      const to = offer.pricePerPack ? Math.round(entered / nominalPackSize(offer)) : entered;
      if (to === from) continue;
      changes.push({
        tierId: t.id,
        tierName: t.name,
        fromAgorot: from,
        toAgorot: to,
        fromSheet,
        toSheet: entered,
        needsApproval: approval(from, to),
      });
    }
    const avail = columns.available === undefined ? null : availableOf(cells[columns.available]);
    if (avail === "bad") bad ??= `בעמודה "זמין" כתבו כן או לא`;
    if (bad) {
      out.push({ line, offerId: offer.id, label: itemLabel, changes: [], error: bad });
      return;
    }
    const availChange = typeof avail === "boolean" && avail !== offer.available ? avail : undefined;
    if (changes.length === 0 && availChange === undefined) {
      unchanged++;
      return;
    }
    out.push({
      line,
      offerId: offer.id,
      label: itemLabel,
      per: perLabel(offer),
      changes,
      ...(availChange !== undefined ? { available: availChange } : {}),
    });
  });
  return { rows: out, unchanged, missing: offers.filter((o) => !seen.has(o.id)).length };
}
