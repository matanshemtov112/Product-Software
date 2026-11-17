/**
 * ההצעה שהמערכת הציגה ללקוח (המחירים בהשוואה, במבצע או בבקשת השוואה) נכונה לרגע שליחת הפנייה,
 * ובתוקף 12 שעות. אחר כך המחירים במערכת אולי השתנו, וצריך לבדוק מחדש.
 */
export const QUOTE_VALID_HOURS = 12;

export const quoteValidUntil = (sentAt: Date) => new Date(sentAt.getTime() + QUOTE_VALID_HOURS * 3_600_000);

export const quoteExpired = (sentAt: Date, now = new Date()) => quoteValidUntil(sentAt) <= now;

/** תאריך ושעה בשעון ישראל, למשל "17.11.2026, 22:38" */
export const dateTime = (d: Date) =>
  d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });
