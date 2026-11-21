/**
 * מיקום הספק מול השוק, לכל מוצר שלו. הספק לא רואה שמות של מתחרים או את המחיר של מתחרה מסוים:
 * רק את המקום שלו בדירוג, באיזה טווח הוא מעל המחיר הזול, ואת מחיר השוק החציוני (החלטה מ-2026-11-01).
 * מוצר עם פחות משלושה ספקים לא מוצג, כי אז קל לנחש מה המתחרה גובה.
 */

export const MIN_SUPPLIERS = 3;

export type MarketBand = "CHEAPEST" | "CLOSE" | "MID" | "HIGH";

export const MARKET_BAND_LABEL: Record<MarketBand, string> = {
  CHEAPEST: "הזול ביותר",
  CLOSE: "עד 3% מעל הזול",
  MID: "בין 3% ל-10% מעל הזול",
  HIGH: "יותר מ-10% מעל הזול",
};

export interface MarketPosition {
  band: MarketBand;
  /** המקום של הספק מהזול ליקר (1 = הזול) */
  rank: number;
  /** כמה ספקים מוכרים את המוצר, כולל הספק */
  suppliers: number;
  /** מחיר השוק: החציון של כל הספקים, כולל הספק עצמו */
  medianAgorot: number;
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function marketPosition(ownAgorot: number, othersAgorot: number[]): MarketPosition | null {
  const suppliers = othersAgorot.length + 1;
  if (suppliers < MIN_SUPPLIERS) return null;
  const min = Math.min(...othersAgorot);
  const rank = othersAgorot.filter((p) => p < ownAgorot).length + 1;
  const gap = (ownAgorot - min) / min;
  const band: MarketBand = ownAgorot <= min ? "CHEAPEST" : gap <= 0.03 ? "CLOSE" : gap <= 0.1 ? "MID" : "HIGH";
  return { band, rank, suppliers, medianAgorot: median([ownAgorot, ...othersAgorot]) };
}
