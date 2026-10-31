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
    /** המחיר ליחידה שהלקוח משלם היום, אם מילא (בלי שם הספק הנוכחי) */
    customerPaidAgorot?: number | null;
    /** איך המוצר מגיע אצל הספק והמינימום להזמנה */
    pack?: string;
    minOrder?: string | null;
    /** המחיר לאריזה, למשל "₪72.00 לפח 4 ליטר" */
    packPrice?: string;
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

/** פרטי הלקוח שנשלחים לספק עם הפנייה, כפי שהיו ברגע השליחה */
export interface CustomerProfileSnapshot {
  businessName: string;
  businessType: string;
  cuisine: string | null;
  city: string;
  /** כתובת העסק; חסרה בפניות שנשלחו לפני שנוספה */
  address?: string | null;
  region: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  /** טווח היקף הרכש החודשי שהלקוח הצהיר, למשל "₪20,000–50,000"; null אם לא הצהיר */
  monthlyVolume: string | null;
  /** היקף הרכש הכולל מכל הספקים, כפי שהוצהר בהרשמה */
  totalVolume?: string | null;
  deliveriesPerMonth: number;
  basketName: string;
  itemCount: number;
  customerSince: string;
}

export function isCustomerProfile(value: unknown): value is CustomerProfileSnapshot {
  return (
    typeof value === "object" && value !== null && typeof (value as CustomerProfileSnapshot).businessName === "string"
  );
}

/** השורות שמוצגות לספק ולקוח: מה בדיוק נשלח */
export function profileRows(p: CustomerProfileSnapshot): [string, string][] {
  const rows: [string, string | null][] = [
    ["שם העסק", p.businessName],
    ["סוג העסק", p.cuisine ? `${p.businessType} · ${p.cuisine}` : p.businessType],
    ["עיר ואזור", `${p.city} · ${p.region}`],
    ["כתובת", p.address ?? null],
    ["איש קשר", p.contactName],
    ["טלפון", p.phone],
    ["אימייל", p.email],
    ["היקף רכש חודשי", p.monthlyVolume ? `${p.monthlyVolume} (ללא מע״מ)` : "לא צוין"],
    ["היקף רכש כולל", p.totalVolume ? `${p.totalVolume} בחודש, מכל הספקים` : null],
    ["אספקות בחודש", String(p.deliveriesPerMonth)],
    ["הסל", `${p.basketName} · ${p.itemCount} מוצרים`],
    ["לקוח במערכת מאז", p.customerSince],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}
