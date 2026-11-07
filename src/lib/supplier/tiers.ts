export const MAX_TIERS = 6;

export interface TierInput {
  /** מזהה מדרגה קיימת; ריק למדרגה חדשה */
  id: string;
  name: string;
  /** מאיזה היקף רכש חודשי המדרגה חלה, בשקלים ללא מע״מ, כפי שהוקלד */
  min: string;
}

export interface TierRow {
  id: string | null;
  name: string;
  minMonthlyAgorot: number;
}

/**
 * בודק את המדרגות שהספק הגדיר: הראשונה מתחילה מ-0, הספים עולים ושונים זה מזה,
 * ולכל מדרגה יש שם. מחזיר אותן ממוינות לפי הסף.
 */
export function parseTiers(inputs: TierInput[]): { ok: true; tiers: TierRow[] } | { ok: false; error: string } {
  if (inputs.length === 0) return { ok: false, error: "צריך לפחות מדרגה אחת" };
  if (inputs.length > MAX_TIERS) return { ok: false, error: `אפשר עד ${MAX_TIERS} מדרגות` };
  const tiers: TierRow[] = [];
  for (const [i, t] of inputs.entries()) {
    const name = t.name.trim();
    if (name.length < 2 || name.length > 30) return { ok: false, error: `נא לתת שם קצר למדרגה ${i + 1}` };
    const raw = t.min.replace(/[₪,\s]/g, "");
    const min = raw === "" && i === 0 ? 0 : Number(raw);
    if (!Number.isFinite(min) || min < 0 || !Number.isInteger(min))
      return { ok: false, error: `נא למלא סכום שלם בשקלים למדרגה "${name}"` };
    tiers.push({ id: t.id || null, name, minMonthlyAgorot: min * 100 });
  }
  tiers.sort((a, b) => a.minMonthlyAgorot - b.minMonthlyAgorot);
  if (tiers[0].minMonthlyAgorot !== 0) return { ok: false, error: "המדרגה הראשונה צריכה להתחיל מ-₪0" };
  for (let i = 1; i < tiers.length; i++)
    if (tiers[i].minMonthlyAgorot === tiers[i - 1].minMonthlyAgorot)
      return { ok: false, error: "לשתי מדרגות יש אותו סכום התחלה" };
  return { ok: true, tiers };
}
