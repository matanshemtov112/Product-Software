/** טווחי היקף רכש חודשי לבחירה, בשקלים ללא מע״מ; max null = ומעלה */
export const VOLUME_RANGES: { key: string; label: string; min: number; max: number | null }[] = [
  { key: "0-10", label: "עד ₪10,000", min: 0, max: 10_000 },
  { key: "10-20", label: "₪10,000–20,000", min: 10_000, max: 20_000 },
  { key: "20-50", label: "₪20,000–50,000", min: 20_000, max: 50_000 },
  { key: "50-100", label: "₪50,000–100,000", min: 50_000, max: 100_000 },
  { key: "100-150", label: "₪100,000–150,000", min: 100_000, max: 150_000 },
  { key: "150+", label: "מעל ₪150,000", min: 150_000, max: null },
];

export function volumeRangeFor(minAgorot: number | null) {
  if (minAgorot === null) return null;
  return VOLUME_RANGES.find((r) => r.min * 100 === minAgorot) ?? null;
}
