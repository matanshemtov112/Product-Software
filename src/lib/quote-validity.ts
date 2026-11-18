/**
 * הזמנים של פנייה לספק (וגם של בקשת השוואה):
 * - לפני השליחה: דף פנייה שנפתח לפני יותר מ-12 שעות מחושב מחדש לפני שהפנייה נשלחת.
 * - אחרי השליחה: המחירים בפנייה נעולים ללקוח 3 ימים.
 * - אחרי 24 שעות בלי תשובה הספק מקבל תזכורת, ואחרי 3 ימים בלי תשובה הפנייה נסגרת ("הספק לא ענה").
 */
export const SEND_WINDOW_HOURS = 12;
export const LOCK_DAYS = 3;
export const LOCK_HOURS = LOCK_DAYS * 24;
export const REMINDER_HOURS = 24;

const HOUR = 3_600_000;

export const lockedUntil = (sentAt: Date) => new Date(sentAt.getTime() + LOCK_HOURS * HOUR);

export const lockEnded = (sentAt: Date, now = new Date()) => lockedUntil(sentAt) <= now;

/** דף שנפתח לפני יותר מ-12 שעות: המחירים בו כבר לא נחשבים עדכניים לשליחה */
export const pageStale = (loadedAtMs: number, now = Date.now()) =>
  !Number.isFinite(loadedAtMs) || now - loadedAtMs > SEND_WINDOW_HOURS * HOUR;

/** מתי פנייה בלי תשובה מקבלת תזכורת, ומתי היא נסגרת */
export const reminderDue = (sentAt: Date, now = new Date()) =>
  now.getTime() - sentAt.getTime() >= REMINDER_HOURS * HOUR && !lockEnded(sentAt, now);

/** תאריך ושעה בשעון ישראל, למשל "17.11.2026, 22:38" */
export const dateTime = (d: Date) =>
  d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });
