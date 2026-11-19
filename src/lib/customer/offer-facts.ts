import { cache } from "react";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";

/** מה הלקוח צריך לדעת על כל ספק בהצעה: מינימום הזמנה ואיפה הוא עובד */
export interface SupplierFacts {
  minOrderAgorot: number;
  areaText: string;
}

const km = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

/** אזור העבודה של ספק במילים: העיגולים שסימן על המפה, ואם לא סימן, האזורים הכלליים */
export function areaText(areas: { label: string; radiusKm: number }[], regions: string[]): string {
  if (areas.length > 0) {
    const sorted = [...areas].sort((a, b) => b.radiusKm - a.radiusKm);
    const shown = sorted.slice(0, 3).map((a) => `עד ${km(a.radiusKm)} ק״מ מ${a.label}`);
    const more = sorted.length > 3 ? ` ועוד ${sorted.length - 3} אזורים` : "";
    return shown.join(", ") + more;
  }
  if (regions.length > 0) return regions.join(", ");
  return "לא הוגדר";
}

/** נטען פעם אחת לכל ספק בכל עמוד, גם כשהוא מופיע בכמה הצעות */
export const supplierFacts = cache(async (supplierId: string): Promise<SupplierFacts | null> => {
  const s = await db.supplier.findUnique({
    where: { id: supplierId },
    select: {
      minOrderAgorot: true,
      deliveryAreas: { select: { label: true, radiusKm: true } },
      deliveryZones: { select: { region: { select: { name: true } } } },
    },
  });
  if (!s) return null;
  return {
    minOrderAgorot: s.minOrderAgorot,
    areaText: areaText(
      s.deliveryAreas,
      s.deliveryZones.map((z) => z.region.name),
    ),
  };
});

export function minOrderText(agorot: number) {
  return agorot > 0 ? `${shekels(agorot)} להזמנה` : "אין מינימום";
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

/**
 * עד מתי ההצעה בתוקף: התאריך המוקדם ביותר שבו אחד המחירים בהצעה נגמר (מבצע או מחיר עם תוקף).
 * מחירון קבוע אין לו תאריך סיום.
 */
export function validityText(lines: { priceKind?: string; priceValidTo?: string | null }[]) {
  const ends = lines.filter((l) => l.priceValidTo).sort((a, b) => a.priceValidTo!.localeCompare(b.priceValidTo!));
  if (ends.length === 0) return "מחירון קבוע, בלי תאריך סיום";
  const first = ends[0];
  const date = day(first.priceValidTo!);
  if (ends.length === lines.length) return `המחירים בתוקף עד ${date}`;
  const what = first.priceKind === "PROMOTION" ? "מבצע" : "מחיר מובטח";
  return `${what} על חלק מהמוצרים עד ${date}, שאר המחירים קבועים`;
}
