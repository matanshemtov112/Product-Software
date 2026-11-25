import type { DocumentKind, DocumentStatus } from "@prisma/client";

// אימות ספק לפי מסמכים: מה נדרש, ומתי הספק נחשב מאומת. בלי גישה למסד

export const DOC_LABEL: Record<DocumentKind, string> = {
  BUSINESS_LICENSE: "תעודת עוסק מורשה או תעודת התאגדות",
  MANUFACTURER_LICENSE: "רישיון יצרן",
  HEALTH_LICENSE: "אישור משרד הבריאות",
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: "ממתין לבדיקה",
  APPROVED: "אושר",
  REJECTED: "נדחה",
};

/** המסמכים הנדרשים: תעודת עוסק לכולם, ולמפעל שמייצר גם רישיון יצרן ואישור משרד הבריאות */
export function requiredDocs(isManufacturer: boolean): DocumentKind[] {
  return isManufacturer ? ["BUSINESS_LICENSE", "MANUFACTURER_LICENSE", "HEALTH_LICENSE"] : ["BUSINESS_LICENSE"];
}

export interface DocLike {
  kind: DocumentKind;
  status: DocumentStatus;
  validUntil: Date | null;
}

export type DocState = "MISSING" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export function docState(doc: DocLike | undefined, now = new Date()): DocState {
  if (!doc) return "MISSING";
  if (doc.status === "APPROVED" && doc.validUntil && doc.validUntil <= now) return "EXPIRED";
  return doc.status;
}

/** האם הספק מאומת, ועד מתי: כל המסמכים הנדרשים אושרו ובתוקף */
export function verification(docs: DocLike[], isManufacturer: boolean, now = new Date()) {
  const states = requiredDocs(isManufacturer).map((kind) => ({
    kind,
    state: docState(
      docs.find((d) => d.kind === kind),
      now,
    ),
  }));
  const verified = states.every((s) => s.state === "APPROVED");
  const dates = docs
    .filter((d) => requiredDocs(isManufacturer).includes(d.kind) && d.validUntil)
    .map((d) => d.validUntil!.getTime());
  return {
    verified,
    until: verified && dates.length ? new Date(Math.min(...dates)) : null,
    states,
  };
}

/** ספק מאומת עכשיו: יש תאריך אימות, והתוקף לא עבר */
export const isVerified = (s: { verifiedAt: Date | null; verifiedUntil: Date | null }, now = new Date()) =>
  Boolean(s.verifiedAt) && (!s.verifiedUntil || s.verifiedUntil > now);

/** כמה זמן לפני שמסמך פג מזכירים לספק לחדש */
export const RENEW_WARNING_DAYS = 30;

/** בדיקת קובץ מסמך: PDF, JPG או PNG, עד 5MB. הסוג נקבע לפי התוכן ולא לפי מה שהדפדפן הצהיר */
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
const SIGNATURES: { type: string; matches: (b: Uint8Array) => boolean }[] = [
  { type: "application/pdf", matches: (b) => String.fromCharCode(...b.slice(0, 5)) === "%PDF-" },
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", matches: (b) => [0x89, 0x50, 0x4e, 0x47].every((v, i) => b[i] === v) },
];

export function detectDocType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((s) => s.matches(bytes))?.type ?? null;
}
