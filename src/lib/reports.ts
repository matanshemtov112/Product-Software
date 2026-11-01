import type { ReportReason, ReportStatus } from "@prisma/client";

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  WRONG_PRICE: "מחירים לא נכונים או מטעים",
  FAKE_BUSINESS: "עסק שנראה מזויף",
  ABUSIVE: "התנהגות פוגענית",
  SPAM: "הודעות לא רצויות",
  OTHER: "אחר",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "פתוח",
  RESOLVED: "טופל",
  DISMISSED: "נסגר בלי פעולה",
};
