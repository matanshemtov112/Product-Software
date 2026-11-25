import type { InvoiceFile } from "./read";

/** עמודי חשבונית: תמונות מוקטנות בדפדפן, או PDF כפי שהוא */
export const MAX_INVOICE_FILES = 5;
export const MAX_INVOICE_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_INVOICE_TOTAL_BYTES = 9 * 1024 * 1024;

const SIGNATURES: { type: InvoiceFile["mediaType"]; matches: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", matches: (b) => [0x89, 0x50, 0x4e, 0x47].every((v, i) => b[i] === v) },
  {
    type: "image/webp",
    matches: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
  { type: "application/pdf", matches: (b) => String.fromCharCode(...b.slice(0, 5)) === "%PDF-" },
];

export type InvoiceFilesCheck = { ok: true; files: InvoiceFile[] } | { ok: false; error: string };

/** בודק את הקבצים שהועלו. הסוג נקבע לפי תוכן הקובץ ולא לפי מה שהדפדפן הצהיר */
export async function checkInvoiceFiles(entries: unknown[]): Promise<InvoiceFilesCheck> {
  const uploads = entries.filter((f): f is File => f instanceof File && f.size > 0);
  if (uploads.length === 0) return { ok: false, error: "נא לצלם או לבחור את החשבונית" };
  if (uploads.length > MAX_INVOICE_FILES)
    return { ok: false, error: `אפשר להעלות עד ${MAX_INVOICE_FILES} עמודים בכל פעם` };
  if (uploads.some((f) => f.size > MAX_INVOICE_FILE_BYTES))
    return { ok: false, error: "אחד הקבצים גדול מדי (עד 4MB לקובץ)" };
  if (uploads.reduce((sum, f) => sum + f.size, 0) > MAX_INVOICE_TOTAL_BYTES)
    return { ok: false, error: "הקבצים גדולים מדי יחד. נסו להעלות פחות עמודים" };
  const files: InvoiceFile[] = [];
  for (const upload of uploads) {
    const data = Buffer.from(await upload.arrayBuffer());
    const match = SIGNATURES.find((s) => s.matches(data));
    if (!match) return { ok: false, error: "אפשר להעלות תמונה (JPG, PNG, WEBP) או PDF" };
    files.push({ data, mediaType: match.type });
  }
  return { ok: true, files };
}
