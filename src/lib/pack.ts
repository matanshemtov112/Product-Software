import { shekels, UNIT_LABEL } from "@/lib/format";

export const PACK_LABEL = {
  UNIT: "יחידה",
  CARTON: "קרטון",
  CRATE: "ארגז",
  SACK: "שק",
  TIN: "פח",
  BOTTLE: "בקבוק",
  PACK: "חבילה",
  TRAY: "מגש",
  BUCKET: "דלי",
} as const;

export type PackTypeKey = keyof typeof PACK_LABEL;

export interface PackInfo {
  unit: keyof typeof UNIT_LABEL;
  packType: PackTypeKey | null;
  packSize: number;
  packSizeMax: number | null;
  minQuantity: number;
  minPacks: number | null;
}

const num = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 2 });

/** גודל האריזה לחישובים: במשקל משתנה, אמצע הטווח */
export function nominalPackSize(p: Pick<PackInfo, "packSize" | "packSizeMax">) {
  return p.packSizeMax && p.packSizeMax > p.packSize ? (p.packSize + p.packSizeMax) / 2 : p.packSize;
}

/** הכמות המינימלית להזמנה ביחידות בסיס, לחישוב במנוע */
export function minBaseQuantity(p: PackInfo) {
  return Math.max(p.minQuantity, p.minPacks ? p.minPacks * nominalPackSize(p) : 0);
}

/** תכולת אריזה אחת, למשל "15–20 ק״ג" */
export function packContent(p: Pick<PackInfo, "unit" | "packSize" | "packSizeMax">) {
  const range =
    p.packSizeMax && p.packSizeMax > p.packSize ? `${num(p.packSize)}–${num(p.packSizeMax)}` : num(p.packSize);
  return `${range} ${UNIT_LABEL[p.unit]}`;
}

/** איך המוצר מגיע, למשל "קרטון 15–20 ק״ג" או "נמכר לפי ק״ג" */
export function packLabel(p: Pick<PackInfo, "unit" | "packType" | "packSize" | "packSizeMax">) {
  if (!p.packType && p.packSize === 1 && !p.packSizeMax) return `נמכר לפי ${UNIT_LABEL[p.unit]}`;
  if (p.packType === "UNIT" && p.unit === "UNIT" && p.packSize === 1) return "יחידה";
  return `${p.packType ? PACK_LABEL[p.packType] : "אריזה"} ${packContent(p)}`;
}

/** הכמות המינימלית להזמנה, למשל "2 × קרטון (15–20 ק״ג)", או null כשאין מינימום */
export function minOrderLabel(p: PackInfo) {
  if (p.minPacks) return `${p.minPacks} × ${p.packType ? PACK_LABEL[p.packType] : "אריזה"} (${packContent(p)})`;
  if (p.minQuantity > 0) return `${num(p.minQuantity)} ${UNIT_LABEL[p.unit]}`;
  return null;
}

/**
 * האם להציג מחיר לאריזה: רק כשהספק בחר לתמחר לפי אריזה (מחיר קומפלט לפח, לקרטון).
 * מוצר שקיל, כמו אנטריקוט בקרטון, מתומחר לפי ק״ג ומוצג רק במחיר לק״ג.
 */
export function pricedPerPack(p: Pick<PackInfo, "packType" | "packSize" | "packSizeMax"> & { pricePerPack?: boolean }) {
  return Boolean(p.pricePerPack) && (p.packSize !== 1 || p.packType !== null);
}

/** מחיר לאריזה לפי מחיר ליחידה, למשל "₪72.00 לפח 4 ליטר"; במשקל משתנה טווח מחירים */
export function packPriceLabel(
  unitPriceAgorot: number,
  p: Pick<PackInfo, "unit" | "packType" | "packSize" | "packSizeMax">,
) {
  const name = p.packType ? PACK_LABEL[p.packType] : "אריזה";
  const low = shekels(Math.round(unitPriceAgorot * p.packSize), 2);
  const price =
    p.packSizeMax && p.packSizeMax > p.packSize
      ? `${low}–${shekels(Math.round(unitPriceAgorot * p.packSizeMax), 2)}`
      : low;
  return `${price} ל${name} ${packContent(p)}`;
}
