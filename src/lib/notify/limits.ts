/** כמה פעמים ספק יכול לשלוח או לעדכן תשובה לאותה פנייה או בקשת השוואה */
export const MAX_REPLIES = 3;

export const REPLY_LIMIT_MESSAGE = `אפשר לשלוח עד ${MAX_REPLIES} תשובות לאותה פנייה, כדי לא להציף את הלקוח. אם משהו השתנה, חכו שהלקוח יחליט או יפנה שוב.`;

/** כמה עסקים צריכים לחסום ספק ב-90 יום כדי שהאדמין יקבל דיווח לבדיקה */
export const BLOCKS_TO_FLAG = 3;
export const BLOCK_WINDOW_DAYS = 90;

/** כמה מחיר שלא עודכן נחשב ישן (ימים) */
export const STALE_PRICE_DAYS = 30;
