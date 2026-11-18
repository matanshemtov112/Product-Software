import type { TeamRole } from "@prisma/client";

/** מה אפשר לעשות במערכת. כל תפקיד מקבל רשימה קבועה של הרשאות */
export type Permission =
  /** פרטי העסק, תנאים, מדרגות, אזורים, אימות וניהול הצוות */
  | "manage"
  /** מסעדה: סלים, פניות לספקים, בקשות השוואה, החלטות על הצעות, חשבוניות והיסטוריה */
  | "buy"
  /** ספק: מחירים, מוצרים, מבצעים ותמונות */
  | "prices"
  /** ספק: מענה לפניות ולבקשות השוואה, ביקורת על לקוח */
  | "reply"
  /** דיווח על בעיה (ספק, ביקורת, מחיר) */
  | "report";

export type OrgKind = "CUSTOMER" | "SUPPLIER";

const GRANTS: Record<TeamRole, readonly Permission[]> = {
  MANAGER: ["manage", "buy", "prices", "reply", "report"],
  BUYER: ["buy", "report"],
  PRICING: ["prices", "report"],
  SALES: ["reply", "report"],
  VIEWER: [],
};

/** התפקידים שאפשר לבחור, לפי סוג הארגון, בסדר שבו הם מוצגים */
export const ROLES_FOR: Record<OrgKind, readonly TeamRole[]> = {
  CUSTOMER: ["MANAGER", "BUYER", "VIEWER"],
  SUPPLIER: ["MANAGER", "PRICING", "SALES", "VIEWER"],
};

export const ROLE_LABEL: Record<TeamRole, string> = {
  MANAGER: "מנהל",
  BUYER: "קניין",
  PRICING: "מנהל מחירון",
  SALES: "איש מכירות",
  VIEWER: "צופה",
};

export const ROLE_DESCRIPTION: Record<OrgKind, Partial<Record<TeamRole, string>>> = {
  CUSTOMER: {
    MANAGER: "הכול: פרטי העסק, הצוות, סלים, פניות לספקים וקבלת הצעות",
    BUYER: "בונה סלים, משווה מחירים, שולח פניות ומקבל או דוחה הצעות. לא משנה את פרטי העסק ואת הצוות",
    VIEWER: "רואה את הסלים, ההשוואות וההצעות, בלי לשנות ובלי לשלוח",
  },
  SUPPLIER: {
    MANAGER: "הכול: פרטי הספק, תנאים, מדרגות, אזורים, אימות, הצוות, מחירים ופניות",
    PRICING: "מעדכן מחירים, מוצרים, מבצעים ותמונות. לא עונה לפניות",
    SALES: "עונה לפניות ולבקשות השוואה של לקוחות. לא משנה את המחירון",
    VIEWER: "רואה את המחירון, הפניות והדוחות, בלי לשנות ובלי לענות",
  },
};

export function roleCan(role: TeamRole, permission: Permission) {
  return GRANTS[role].includes(permission);
}

/** האם התפקיד מתאים לסוג הארגון (קניין רק במסעדה, מחירון ומכירות רק אצל ספק) */
export function roleFits(kind: OrgKind, role: string): role is TeamRole {
  return (ROLES_FOR[kind] as readonly string[]).includes(role);
}

/** ההסבר שמוצג כשעובד מנסה לעשות משהו שהתפקיד שלו לא מרשה */
export const DENIED: Record<Permission, string> = {
  manage: "רק מנהל יכול לשנות את פרטי העסק ואת הצוות",
  buy: "התפקיד שלכם מאפשר לצפות בלבד. כדי לבנות סלים ולשלוח פניות צריך תפקיד קניין או מנהל",
  prices: "התפקיד שלכם לא מאפשר לשנות מחירים ומוצרים. צריך תפקיד מנהל מחירון או מנהל",
  reply: "התפקיד שלכם לא מאפשר לענות לפניות. צריך תפקיד איש מכירות או מנהל",
  report: "התפקיד שלכם מאפשר לצפות בלבד, ולכן אי אפשר לשלוח דיווח",
};

const ALL: readonly Permission[] = ["manage", "buy", "prices", "reply", "report"];

/** ההרשאות שחסרות לתפקיד, כרשימה מופרדת ברווחים (לסימון data-lacks באזור הלקוח והספק) */
export function lacking(role: TeamRole | null) {
  return ALL.filter((p) => !role || !roleCan(role, p)).join(" ");
}
