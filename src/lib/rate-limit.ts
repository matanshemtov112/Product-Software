import { db } from "@/lib/db";

/**
 * הגבלת קצב: כמה פעמים מותר לעשות פעולה בחלון זמן.
 * הספירה נשמרת במסד (RateLimitHit), כך שהיא משותפת לכל השרתים ולא מתאפסת כשהשרת מופעל מחדש.
 * כל ניסיון נרשם קודם ורק אז נבדק, כך שגם הרבה ניסיונות באותו רגע נעצרים במגבלה.
 */

export interface Limit {
  max: number;
  windowMs: number;
}

export const LIMITS = {
  /** ניסיונות כניסה שנכשלו, לכל אימייל מאותה כתובת */
  loginFailures: { max: 5, windowMs: 15 * 60_000 },
  /**
   * ניסיונות כניסה שנכשלו לאימייל אחד מכל הכתובות יחד. גבוה בכוונה: עוצר ניחוש סיסמאות מהרבה מחשבים,
   * בלי שמישהו יוכל לנעול לקוח מחוץ לחשבון בכמה ניסיונות שגויים
   */
  loginPerEmail: { max: 50, windowMs: 60 * 60_000 },
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
  /** חיפושי תמונות במאגרים פתוחים, לכל ספק */
  imageSearch: { max: 60, windowMs: 60 * 60_000 },
  /** בקשות לאיפוס סיסמה, לכל אימייל ולכל כתובת */
  passwordReset: { max: 5, windowMs: 60 * 60_000 },
  /** העלאות מחירון מקובץ, לכל ספק */
  priceImports: { max: 30, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/** איפה נשמרים הניסיונות: במסד, או בזיכרון (בבדיקות) */
export interface RateStore {
  add(key: string, at: number): Promise<void>;
  /** זמני הניסיונות של המפתח מאז since, מהישן לחדש */
  since(key: string, since: number): Promise<number[]>;
  clear(key: string): Promise<void>;
}

export class MemoryStore implements RateStore {
  private readonly hits = new Map<string, number[]>();
  async add(key: string, at: number) {
    this.hits.set(key, [...(this.hits.get(key) ?? []), at]);
  }
  async since(key: string, since: number) {
    return (this.hits.get(key) ?? []).filter((t) => t > since);
  }
  async clear(key: string) {
    this.hits.delete(key);
  }
}

const DAY = 24 * 60 * 60_000;

export const dbStore: RateStore = {
  async add(key, at) {
    await db.rateLimitHit.create({ data: { key, at: new Date(at) } });
    // ניקוי מדי פעם של ניסיונות ישנים מהחלון הארוך ביותר (יום)
    if (Math.random() < 0.01) await db.rateLimitHit.deleteMany({ where: { at: { lt: new Date(at - DAY) } } });
  },
  async since(key, since) {
    const rows = await db.rateLimitHit.findMany({
      where: { key, at: { gt: new Date(since) } },
      select: { at: true },
      orderBy: { at: "asc" },
    });
    return rows.map((r) => r.at.getTime());
  },
  async clear(key) {
    await db.rateLimitHit.deleteMany({ where: { key } });
  },
};

export class RateLimiter {
  constructor(
    private readonly store: RateStore = new MemoryStore(),
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string, limit: Limit) {
    return this.store.since(key, this.now() - limit.windowMs);
  }

  /** האם הפעולה חסומה כרגע (בלי לספור אותה) */
  async blocked(key: string, limit: Limit) {
    return (await this.recent(key, limit)).length >= limit.max;
  }

  /** סופר פעולה; מחזיר false אם היא מעבר למגבלה */
  async hit(key: string, limit: Limit) {
    await this.store.add(key, this.now());
    return (await this.recent(key, limit)).length <= limit.max;
  }

  async reset(key: string) {
    await this.store.clear(key);
  }

  /** בעוד כמה דקות אפשר לנסות שוב */
  async retryMinutes(key: string, limit: Limit) {
    const list = await this.recent(key, limit);
    if (list.length < limit.max) return 0;
    // החסימה נגמרת כשמספיק ניסיונות ישנים יוצאים מהחלון
    const freeAt = list[list.length - limit.max] + limit.windowMs;
    return Math.max(1, Math.ceil((freeAt - this.now()) / 60_000));
  }
}

export const rateLimit = new RateLimiter(process.env.VITEST ? new MemoryStore() : dbStore);
