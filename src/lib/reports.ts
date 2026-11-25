import type { ReportReason, ReportStatus, ReportTarget } from "@prisma/client";

/** שם הסיבה כפי שהוא מוצג לצוות הפלטפורמה */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  WRONG_PRICE: "המחיר לא נכון",
  PRICE_NOT_HONORED: "הספק לא מכבד מחיר",
  PRODUCT_MISMATCH: "מוצר לא תואם",
  FAKE_REVIEW: "ביקורת מזויפת",
  FAKE_BUSINESS: "מתחזה",
  WRONG_INFO: "מידע שגוי",
  ABUSIVE: "התנהגות פוגענית",
  SPAM: "הודעות לא רצויות",
  OTHER: "בעיה אחרת",
};

/** הסיבות שאפשר לבחור לפי מי שמדווחים עליו, בניסוח למדווח */
export const REPORT_REASONS_FOR: Record<ReportTarget, [ReportReason, string][]> = {
  SUPPLIER: [
    ["WRONG_PRICE", "המחיר במערכת לא נכון"],
    ["PRICE_NOT_HONORED", "הספק לא מכבד מחיר"],
    ["PRODUCT_MISMATCH", "המוצר שסופק לא תואם לתיאור"],
    ["FAKE_REVIEW", "ביקורת מזויפת"],
    ["FAKE_BUSINESS", "ספק מתחזה"],
    ["WRONG_INFO", "מידע שגוי על הספק"],
    ["ABUSIVE", "התנהגות פוגענית"],
    ["SPAM", "הודעות לא רצויות"],
    ["OTHER", "בעיה אחרת"],
  ],
  CUSTOMER: [
    ["FAKE_REVIEW", "ביקורת מזויפת עליי"],
    ["FAKE_BUSINESS", "עסק מתחזה"],
    ["WRONG_INFO", "מידע שגוי על העסק"],
    ["ABUSIVE", "התנהגות פוגענית"],
    ["SPAM", "הודעות לא רצויות"],
    ["OTHER", "בעיה אחרת"],
  ],
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "פתוח",
  RESOLVED: "טופל",
  DISMISSED: "נסגר בלי פעולה",
};
