import type { NotificationCategory, NotificationFrequency, NotificationKind } from "@prisma/client";

/** לאיזו קבוצה כל סוג התראה שייך. הקבוצה קובעת מה המשתמש יכול לכבות ואיך הוא מקבל אותה */
export const CATEGORY_OF: Record<NotificationKind, NotificationCategory> = {
  // חשובות: תמיד, במערכת ובאימייל
  ACCOUNT_STATUS: "CRITICAL",
  PRICE_VIOLATION: "CRITICAL",
  VERIFICATION: "CRITICAL",
  PRICE_APPROVED: "CRITICAL",
  PRICE_REJECTED: "CRITICAL",
  REPLY_REMINDER: "CRITICAL",
  NO_REPLY: "CRITICAL",
  OFFER_EXPIRING: "CRITICAL",
  GUARANTEE_BREACH: "CRITICAL",
  GUARANTEE_CHANGE_REQUESTED: "CRITICAL",
  // הצעות ופניות
  NEW_INQUIRY: "OFFERS",
  NEW_MATCH_REQUEST: "OFFERS",
  SUPPLIER_REPLIED: "OFFERS",
  MATCH_ANSWERED: "OFFERS",
  MATCH_DECIDED: "OFFERS",
  OFFER_VIEWED: "OFFERS",
  OFFER_DECIDED: "OFFERS",
  OFFER_CANCELLED: "OFFERS",
  OFFER_EXPIRED: "OFFERS",
  GUARANTEE_CHANGE_DECIDED: "OFFERS",
  // הזדמנויות
  CHEAPER_SUPPLIER: "SAVINGS",
  INVOICE_SAVINGS: "SAVINGS",
  MONTHLY_REPORT: "SAVINGS",
  NEW_INTEREST: "SAVINGS",
  DEMAND_RISING: "SAVINGS",
  // עדכוני מחירים
  PRICE_INCREASE: "PRICES",
  PRICE_DROP: "PRICES",
  STALE_SUPPLIER_PRICES: "PRICES",
  EXPENSIVE_PRODUCTS: "PRICES",
  UPDATE_NEEDED: "PRICES",
  // שיווקיות: רק למי שבחר
  NEW_DEAL: "MARKETING",
};

export const CATEGORIES: readonly NotificationCategory[] = ["CRITICAL", "OFFERS", "SAVINGS", "PRICES", "MARKETING"];

type Org = "CUSTOMER" | "SUPPLIER";

export const CATEGORY_LABEL: Record<Org, Record<NotificationCategory, { title: string; description: string }>> = {
  CUSTOMER: {
    CRITICAL: {
      title: "התראות חשובות",
      description: "הצעה שעומדת לפוג, ספק שלא ענה בזמן, שינויים בחשבון. תמיד נשלחות.",
    },
    OFFERS: { title: "הצעות מספקים", description: "ספק ענה לפנייה או לבקשת השוואה, או ביטל הצעה." },
    SAVINGS: {
      title: "הזדמנויות לחיסכון",
      description: "ספק שמוכר זול ממה שאתם משלמים, חיסכון שנמצא בחשבונית, הדוח החודשי. מרוכזות בהודעה אחת ליום.",
    },
    PRICES: {
      title: "עדכוני מחירים",
      description: "הספק שלכם העלה מחיר או הוריד אותו משמעותית, או לא עדכן מחירים הרבה זמן.",
    },
    MARKETING: {
      title: "מבצעים של ספקים",
      description: "מבצע חדש של ספק על מוצר שנמצא בסל שלכם. מופיע במערכת, ובאימייל רק אם תבחרו.",
    },
  },
  SUPPLIER: {
    CRITICAL: {
      title: "התראות חשובות",
      description: "פנייה שמחכה לתשובה, אישור מחירים ומסמכים, דיווחים ושינויים בחשבון. תמיד נשלחות.",
    },
    OFFERS: {
      title: "פניות מלקוחות",
      description: "פנייה או בקשת השוואה חדשה, לקוח שקיבל, דחה או ביטל, הצעה שפגה.",
    },
    SAVINGS: { title: "הזדמנויות", description: "עסקים חדשים שראו את המחירים שלכם, וביקוש עולה למוצרים באזור שלכם." },
    PRICES: {
      title: "המחירון שלכם",
      description: "מוצרים שיקרים ביחס לשוק, ותזכורת לעדכן מחירים או אזורי חלוקה. פעם בשבוע.",
    },
    MARKETING: { title: "הודעות שיווקיות", description: "עדכונים על המערכת ועל אפשרויות חדשות. רק אם תבחרו." },
  },
};

export const FREQUENCY_LABEL: Record<NotificationFrequency, string> = {
  OFF: "לא באימייל",
  INSTANT: "מיד",
  DAILY: "סיכום יומי",
  WEEKLY: "סיכום שבועי",
};

/** מה אפשר לבחור לאימייל בכל קבוצה (הראשון ברשימה הוא ברירת המחדל) */
export const EMAIL_OPTIONS: Record<NotificationCategory, readonly NotificationFrequency[]> = {
  CRITICAL: ["INSTANT"],
  OFFERS: ["INSTANT", "OFF"],
  SAVINGS: ["DAILY", "INSTANT", "OFF"],
  PRICES: ["WEEKLY", "INSTANT", "OFF"],
  MARKETING: ["OFF", "WEEKLY"],
};

export interface Pref {
  inApp: boolean;
  email: NotificationFrequency;
}

/** ברירת המחדל: הכול במערכת חוץ משיווקי, ובאימייל לפי האפשרות הראשונה */
export function defaultPref(category: NotificationCategory): Pref {
  // מבצעים על מוצרים שבסל מופיעים במערכת לכולם (אפשר לכבות); אימייל שיווקי רק בהסכמה
  return { inApp: true, email: EMAIL_OPTIONS[category][0] };
}

/** ההעדפה שבתוקף: חשובות תמיד דולקות, ובחירה שלא קיימת בקבוצה חוזרת לברירת המחדל */
export function effectivePref(category: NotificationCategory, saved?: Partial<Pref> | null): Pref {
  if (category === "CRITICAL") return defaultPref("CRITICAL");
  const base = defaultPref(category);
  const email = saved?.email && EMAIL_OPTIONS[category].includes(saved.email) ? saved.email : base.email;
  return { inApp: saved?.inApp ?? base.inApp, email };
}

/** הקבוצות שהמשתמש כיבה במערכת (לסינון רשימת ההתראות והמונה) */
export function hiddenCategories(
  saved: { category: NotificationCategory; inApp: boolean; email: NotificationFrequency }[],
) {
  return CATEGORIES.filter(
    (c) =>
      !effectivePref(
        c,
        saved.find((s) => s.category === c),
      ).inApp,
  );
}
