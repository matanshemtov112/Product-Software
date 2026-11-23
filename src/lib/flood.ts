/**
 * הגבלה כללית לדקה לכל כתובת IP, נגד הצפה בבקשות. רצה ב-middleware, בזיכרון של כל שרת.
 * זו שכבה ראשונה וזולה; ההגבלות החשובות (כניסה, הרשמה, AI, פניות) נשמרות במסד ומשותפות לכל השרתים.
 */
export const FLOOD_LIMITS = {
  /** כל הבקשות (דפים, תמונות, פעולות) */
  all: 300,
  /** שליחת טפסים ופעולות */
  writes: 60,
};
const WINDOW_MS = 60_000;

const g = globalThis as unknown as { __flood?: Map<string, { start: number; all: number; writes: number }> };
const buckets = (g.__flood ??= new Map());

/** מחזיר כמה שניות לחכות אם הכתובת עברה את המגבלה, אחרת 0 */
export function floodCheck(ip: string, write: boolean, now = Date.now(), factor = 1): number {
  let b = buckets.get(ip);
  if (!b || now - b.start >= WINDOW_MS) {
    b = { start: now, all: 0, writes: 0 };
    buckets.set(ip, b);
    if (buckets.size > 50_000) {
      for (const [key, v] of buckets) if (now - v.start >= WINDOW_MS) buckets.delete(key);
    }
  }
  b.all++;
  if (write) b.writes++;
  if (b.all > FLOOD_LIMITS.all * factor || b.writes > FLOOD_LIMITS.writes * factor) {
    return Math.max(1, Math.ceil((b.start + WINDOW_MS - now) / 1000));
  }
  return 0;
}

/**
 * בלי TRUSTED_IP_HEADER הכתובת לקוחה מ-X-Forwarded-For, שמבקר יכול לזייף (כתובת אחרת בכל בקשה).
 * לכן במצב הזה יש גם מגבלה משותפת לכל הבקשות יחד, פי 10 מהמגבלה לכתובת, שאי אפשר לעקוף בזיוף.
 * באתר האמיתי מגדירים TRUSTED_IP_HEADER לכותרת שהשרת המארח קובע, ואז הכתובת אמינה.
 */
export const SHARED_FACTOR = 10;
const SHARED_KEY = "*shared*";

/** בדיקת הצפה לבקשה: לפי כתובת, ובלי כותרת אמינה גם מגבלה משותפת. מחזיר שניות לחכות או 0 */
export function floodCheckRequest(headers: Headers, write: boolean, now = Date.now()): number {
  const trusted = !!process.env.TRUSTED_IP_HEADER?.trim();
  const ip = clientIpFrom(headers);
  const own = ip && ip !== SHARED_KEY ? floodCheck(ip, write, now) : 0;
  if (trusted) return own;
  const shared = floodCheck(SHARED_KEY, write, now, SHARED_FACTOR);
  return Math.max(own, shared);
}

/** הכתובת מכותרת שהשרת המארח קובע (ראו clientIp ב-audit.ts) */
export function clientIpFrom(headers: Headers): string | null {
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) return headers.get(trusted)?.split(",")[0]?.trim() || null;
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}
