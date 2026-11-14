/**
 * הגבלת קצב פשוטה בזיכרון השרת: כמה פעמים מותר לעשות פעולה בחלון זמן.
 * מתאים לשרת אחד (כמו בפיילוט). כשיהיו כמה שרתים, צריך להעביר למסד או ל-Redis.
 */

export interface Limit {
  max: number;
  windowMs: number;
}

export const LIMITS = {
  /** ניסיונות כניסה שנכשלו, לכל אימייל וכתובת */
  loginFailures: { max: 5, windowMs: 15 * 60_000 },
  /** ניסיונות כניסה מאותה כתובת, לכל האימיילים יחד */
  loginPerIp: { max: 30, windowMs: 15 * 60_000 },
  /** הרשמות מאותה כתובת */
  register: { max: 5, windowMs: 60 * 60_000 },
  /** קריאות ל-Claude (חשבוניות וצילומים) לכל עסק: עולות כסף */
  aiRequests: { max: 30, windowMs: 60 * 60_000 },
  /** פניות ובקשות השוואה לספקים, לכל עסק */
  inquiries: { max: 30, windowMs: 24 * 60 * 60_000 },
  /** דיווחים, לכל משתמש */
  reports: { max: 10, windowMs: 24 * 60 * 60_000 },
} satisfies Record<string, Limit>;

type Store = Map<string, number[]>;
const g = globalThis as unknown as { __rateLimit?: Store };
const store: Store = (g.__rateLimit ??= new Map());

export class RateLimiter {
  constructor(
    private readonly hits: Store = new Map(),
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string, limit: Limit) {
    const since = this.now() - limit.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    this.hits.set(key, list);
    return list;
  }

  /** האם הפעולה חסומה כרגע (בלי לספור אותה) */
  blocked(key: string, limit: Limit) {
    return this.recent(key, limit).length >= limit.max;
  }

  /** סופר פעולה; מחזיר false אם היא מעבר למגבלה */
  hit(key: string, limit: Limit) {
    const list = this.recent(key, limit);
    if (list.length >= limit.max) return false;
    list.push(this.now());
    return true;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  /** בעוד כמה דקות אפשר לנסות שוב */
  retryMinutes(key: string, limit: Limit) {
    const list = this.recent(key, limit);
    if (list.length < limit.max) return 0;
    return Math.max(1, Math.ceil((list[0] + limit.windowMs - this.now()) / 60_000));
  }
}

export const rateLimit = new RateLimiter(store);
