/** טווחי היקף רכש חודשי לבחירה, בשקלים ללא מע״מ; max null = ומעלה */
export const VOLUME_RANGES: { key: string; label: string; min: number; max: number | null }[] = [
  { key: "0-5", label: "עד ₪5,000", min: 0, max: 5_000 },
  { key: "5-10", label: "₪5,000–10,000", min: 5_000, max: 10_000 },
  { key: "10-30", label: "₪10,000–30,000", min: 10_000, max: 30_000 },
  { key: "30-50", label: "₪30,000–50,000", min: 30_000, max: 50_000 },
  { key: "50-70", label: "₪50,000–70,000", min: 50_000, max: 70_000 },
  { key: "70-90", label: "₪70,000–90,000", min: 70_000, max: 90_000 },
  { key: "90-110", label: "₪90,000–110,000", min: 90_000, max: 110_000 },
  { key: "110-130", label: "₪110,000–130,000", min: 110_000, max: 130_000 },
  { key: "130-150", label: "₪130,000–150,000", min: 130_000, max: 150_000 },
  { key: "150+", label: "מעל ₪150,000", min: 150_000, max: null },
];

export function volumeRangeFor(minAgorot: number | null) {
  if (minAgorot === null) return null;
  return VOLUME_RANGES.find((r) => r.min * 100 === minAgorot) ?? null;
}
