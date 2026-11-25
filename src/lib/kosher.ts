import type { KosherLevel, Prisma } from "@prisma/client";

/**
 * כשרות: הספק מסמן כשרות כללית לכל המוצרים שלו (ברירת מחדל), וכל מוצר יכול לסמן כשרות אחרת.
 * העסק בוחר איזו כשרות הוא דורש, ובהשוואות מוצגים לו רק מוצרים שעונים על הדרישה.
 * "כשר למהדרין" עונה גם על דרישה ל"כשר".
 */

export const KOSHER_LEVELS = ["NONE", "KOSHER", "MEHADRIN"] as const satisfies readonly KosherLevel[];

export const KOSHER_LABELS: Record<KosherLevel, string> = {
  NONE: "לא כשר",
  KOSHER: "כשר",
  MEHADRIN: "כשר למהדרין",
};

/** מה העסק דורש, כפי שמוצג לו בהגדרות */
export const KOSHER_REQUIRED_LABELS: Record<KosherLevel, string> = {
  NONE: "לא חשוב לנו",
  KOSHER: "רק כשר",
  MEHADRIN: "רק כשר למהדרין",
};

const RANK: Record<KosherLevel, number> = { NONE: 0, KOSHER: 1, MEHADRIN: 2 };

export function isKosherLevel(v: unknown): v is KosherLevel {
  return typeof v === "string" && (KOSHER_LEVELS as readonly string[]).includes(v);
}

/** הכשרות בפועל של מוצר: מה שסומן במוצר, אחרת ברירת המחדל של הספק; null = לא ידוע */
export function effectiveKosher(
  offer: { kosher: KosherLevel | null; kosherAuthority?: string | null },
  supplier: { kosherDefault: KosherLevel | null; kosherAuthority?: string | null },
): { level: KosherLevel | null; authority: string | null } {
  if (offer.kosher)
    return {
      level: offer.kosher,
      authority: offer.kosherAuthority || (offer.kosher === "NONE" ? null : supplier.kosherAuthority || null),
    };
  if (supplier.kosherDefault)
    return {
      level: supplier.kosherDefault,
      authority: supplier.kosherDefault === "NONE" ? null : supplier.kosherAuthority || null,
    };
  return { level: null, authority: null };
}

/** האם רמת כשרות עונה על הדרישה. מוצר בלי סימון לא עונה על שום דרישה */
export function meetsKosher(level: KosherLevel | null, required: KosherLevel): boolean {
  if (required === "NONE") return true;
  return level !== null && RANK[level] >= RANK[required];
}

/** הרמות שעונות על הדרישה */
export function levelsMeeting(required: KosherLevel): KosherLevel[] {
  return KOSHER_LEVELS.filter((l) => RANK[l] >= RANK[required]);
}

/**
 * תנאי לשאילתה על SupplierOffer: רק מוצרים שעונים על הדרישה. ריק כשהעסק לא דורש כשרות.
 * מחזיר AND כדי שאפשר יהיה לשלב אותו עם OR קיים בשאילתה.
 */
export function kosherOfferWhere(required: KosherLevel | null | undefined): Prisma.SupplierOfferWhereInput {
  if (!required || required === "NONE") return {};
  const ok = levelsMeeting(required);
  return {
    AND: [
      {
        OR: [{ kosher: { in: ok } }, { kosher: null, supplier: { kosherDefault: { in: ok } } }],
      },
    ],
  };
}

/** טקסט קצר לתצוגה, למשל "כשר למהדרין · בד״ץ" */
export function kosherText(k: { level: KosherLevel | null; authority: string | null }): string | null {
  if (!k.level) return null;
  return k.authority && k.level !== "NONE" ? `${KOSHER_LABELS[k.level]} · ${k.authority}` : KOSHER_LABELS[k.level];
}
