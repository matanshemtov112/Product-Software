/** הגודל המרבי של תמונת מוצר אחרי ההקטנה בדפדפן */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { type: string; matches: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", matches: (b) => [0x89, 0x50, 0x4e, 0x47].every((v, i) => b[i] === v) },
  {
    type: "image/webp",
    matches: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

export type ImageCheck = { ok: true; data: Buffer; contentType: string } | { ok: false; error: string };

/**
 * בודק קובץ תמונה שהועלה. הסוג נקבע לפי תוכן הקובץ ולא לפי מה שהדפדפן הצהיר,
 * כדי שלא יישמר במסד קובץ שאינו תמונה.
 */
export async function checkImage(file: unknown): Promise<ImageCheck | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "התמונה גדולה מדי (עד 2MB)" };
  const data = Buffer.from(await file.arrayBuffer());
  const match = SIGNATURES.find((s) => s.matches(data));
  if (!match) return { ok: false, error: "אפשר להעלות תמונה מסוג JPG, PNG או WEBP" };
  return { ok: true, data, contentType: match.type };
}
