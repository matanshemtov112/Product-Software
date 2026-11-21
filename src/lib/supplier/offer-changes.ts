import type { OfferChangeKind } from "@prisma/client";
import { sameBrand } from "@/lib/engine/optimize";

/**
 * שינויים במוצר של ספק בלי לאבד היסטוריה. שלושה מצבים:
 * 1. אותו מוצר, ברקוד חדש: הברקוד מתעדכן, הישן נשמר ביומן, ההיסטוריה ממשיכה.
 * 2. אותו מוצר, אריזה אחרת (ליטר ← 900 מ״ל): ההשוואה ממילא לפי מחיר ליחידת מידה; השינוי נרשם ומסומן ללקוח.
 * 3. מותג אחר: לא מאחדים אוטומטית. או מוצר חלופי (פריט חדש, הישן לארכיון), או בקשה לאישור מנהל שזה אותו מוצר.
 */

export const CHANGE_LABEL: Record<OfferChangeKind, string> = {
  BARCODE: "ברקוד",
  SKU: "מק״ט",
  NAME: "השם אצל הספק",
  PACK: "אריזה",
  BRAND: "מותג",
  BRAND_REQUESTED: "בקשה לשינוי מותג (ממתינה לאישור)",
  BRAND_APPROVED: "שינוי המותג אושר",
  BRAND_REJECTED: "שינוי המותג לא אושר",
  REPLACED: "הוחלף במוצר חלופי",
  ARCHIVED: "הועבר לארכיון",
  RESTORED: "הוחזר מהארכיון",
};

/** כמה ימים מסמנים ללקוח שהאריזה השתנתה או שהמוצר הוחלף */
export const CHANGE_NOTICE_DAYS = 60;

export interface OfferIdentity {
  brand: string | null;
  barcode: string | null;
  supplierSku: string | null;
  supplierProductName: string | null;
  /** תיאור האריזה, למשל "בקבוק 1 ל׳" */
  pack: string;
}

export interface ChangeEntry {
  kind: OfferChangeKind;
  oldValue: string | null;
  newValue: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;

/**
 * האם שינוי המותג מחייב החלטה של הספק (מוצר חלופי או אותו מוצר).
 * הוספת מותג למוצר שלא היה לו מותג היא השלמת פרטים, לא החלפה.
 */
export function brandChangeNeedsDecision(before: string | null, after: string | null): boolean {
  return clean(before) !== null && !sameBrand(before, clean(after));
}

/** השינויים בפרטים המזהים בין לפני לאחרי, בלי המותג כשהוא מחייב החלטה (מטופל בנפרד) */
export function diffOffer(before: OfferIdentity, after: OfferIdentity): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  const add = (kind: OfferChangeKind, a: string | null, b: string | null) => {
    if (clean(a) !== clean(b)) changes.push({ kind, oldValue: clean(a), newValue: clean(b) });
  };
  add("BARCODE", before.barcode, after.barcode);
  add("SKU", before.supplierSku, after.supplierSku);
  add("NAME", before.supplierProductName, after.supplierProductName);
  add("PACK", before.pack, after.pack);
  if (!brandChangeNeedsDecision(before.brand, after.brand) && !sameBrand(before.brand, after.brand)) {
    add("BRAND", before.brand, after.brand);
  }
  return changes;
}

/** הסימון ללקוח ליד המחיר: אריזה שהשתנתה לאחרונה, או מוצר חלופי שהחליף מותג אחר */
export function offerChangeNote(
  offer: {
    brand: string | null;
    packChangedAt: Date | null;
    previousPackLabel: string | null;
    replaces: { brand: string | null; archivedAt: Date | null }[];
  },
  currentPack: string,
  now = new Date(),
): string | undefined {
  const recent = (d: Date | null) => d !== null && now.getTime() - d.getTime() < CHANGE_NOTICE_DAYS * 86_400_000;
  const replaced = offer.replaces.find((r) => recent(r.archivedAt));
  if (replaced) {
    return `מוצר חלופי: הספק החליף את ${replaced.brand ?? "המותג הקודם"} ב${offer.brand ? `-${offer.brand}` : "מותג אחר"}. זה לא אותו מוצר`;
  }
  if (recent(offer.packChangedAt) && offer.previousPackLabel && offer.previousPackLabel !== currentPack) {
    return `האריזה השתנתה: ${offer.previousPackLabel} ← ${currentPack}. ההשוואה לפי מחיר ליחידת מידה`;
  }
  return undefined;
}
