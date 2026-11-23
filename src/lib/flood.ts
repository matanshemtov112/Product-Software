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
export function floodCheck(ip: string, write: boolean, now = Date.now()): number {
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
  if (b.all > FLOOD_LIMITS.all || b.writes > FLOOD_LIMITS.writes) {
    return Math.max(1, Math.ceil((b.start + WINDOW_MS - now) / 1000));
  }
  return 0;
}

/** הכתובת מכותרת שהשרת המארח קובע (ראו clientIp ב-audit.ts) */
export function clientIpFrom(headers: Headers): string | null {
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) return headers.get(trusted)?.split(",")[0]?.trim() || null;
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}
