import type { NegotiationStatus, Unit } from "@prisma/client";

export const INQUIRY_STATUS_LABEL: Record<NegotiationStatus, string> = {
  SENT: "חדשה",
  READ: "נקראה",
  OFFERED: "הספק השיב",
  CLOSED: "נסגרה",
};

/** פנייה פתוחה היא פנייה שהספק עוד לא ענה עליה */
export const OPEN_INQUIRY: NegotiationStatus[] = ["SENT", "READ"];

/** ההצעה שהלקוח קיבל, כפי שנשמרת עם הפנייה */
export interface QuoteSnapshot {
  tierName: string;
  lines: {
    productName: string;
    unit: Unit;
    quantity: number;
    billedQuantity: number;
    unitPriceAgorot: number;
    lineTotalAgorot: number;
  }[];
  productsAgorot: number;
  deliveryAgorot: number;
  totalAgorot: number;
  /** פריטים מהסל שהספק לא מוכר */
  missingProducts: string[];
}

export function isQuoteSnapshot(value: unknown): value is QuoteSnapshot {
  return typeof value === "object" && value !== null && Array.isArray((value as QuoteSnapshot).lines);
}
