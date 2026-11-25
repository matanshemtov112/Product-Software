/**
 * חיפוש מוצרים בעברית: ספקים קוראים לאותו מוצר בשמות שונים ("שמן קנולה", "קנולה פח 18 ל׳", "שמן צמחי"),
 * ולכן מחפשים בשם הקנוני, בשמות הנרדפים, בשם שכל ספק נתן למוצר, במותג ובקטגוריה,
 * אחרי נרמול של אותיות סופיות, ניקוד, גרשיים, יחיד ורבים.
 */

const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * מילים שונות לאותו דבר שלא נתפסות בשם, בשם הנרדף או בקטגוריה. רשימה קצרה בכוונה:
 * כל קבוצה רחבה מדי מביאה תוצאות שגויות (למשל "זית" בחיפוש "שמן" יביא זיתים).
 */
const SYNONYMS: string[][] = [
  ["ציפס", "פריט", "פרייז"],
  ["סודה", "קולה", "שתיה"],
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[֑-ׇ]/g, "") // ניקוד וטעמים
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .replace(/["'׳״`]/g, "")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim();
}

/** שורש פשוט: בלי סיומת רבים (ים/ות) ובלי ה' בסוף, כדי ש"עגבניה" ו"עגבניות" יתאימו */
export function stem(token: string): string {
  if (token.length >= 5 && /(ימ|ות)$/.test(token)) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith("ה")) return token.slice(0, -1);
  return token;
}

export function tokens(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean).map(stem);
}

const synonymGroups = SYNONYMS.map((group) => group.map((w) => stem(normalize(w))));

function variants(queryToken: string): string[] {
  const group = synonymGroups.find((g) => g.includes(queryToken));
  return group ? [queryToken, ...group.filter((w) => w !== queryToken)] : [queryToken];
}

/** מילה קצרה חייבת להתאים במלואה (כדי ש"שמן" לא ימצא "שמנת"); מילה ארוכה יכולה להיות תחילת מילה */
function tokenMatches(queryToken: string, fieldToken: string) {
  return queryToken.length <= 3 ? fieldToken === queryToken : fieldToken.startsWith(queryToken);
}

export interface SearchFields {
  /** השם הקנוני בקטלוג */
  name: string;
  /** שמות נרדפים, השמות שספקים נתנו למוצר ומותגים */
  aliases?: string[];
  /** קטגוריה ותת-קטגוריה */
  categories?: string[];
}

/**
 * ציון התאמה של מוצר לחיפוש: 0 אם לא מתאים. כל מילה בחיפוש צריכה להתאים לשדה כלשהו.
 * התאמה בשם הקנוני שווה יותר מבשם נרדף, ששווה יותר מקטגוריה; מילה נרדפת שווה פחות ממילה מדויקת.
 */
export function matchScore(fields: SearchFields, query: string): number {
  const q = tokens(query);
  if (q.length === 0) return 1;
  const weighted: [string[], number][] = [
    [tokens(fields.name), 3],
    [(fields.aliases ?? []).flatMap(tokens), 2],
    [(fields.categories ?? []).flatMap(tokens), 1],
  ];
  let score = 0;
  for (const token of q) {
    let best = 0;
    variants(token).forEach((variant, i) => {
      const exact = i === 0 ? 1 : 0.5;
      for (const [fieldTokens, weight] of weighted) {
        if (fieldTokens.some((t) => tokenMatches(variant, t))) best = Math.max(best, weight * exact);
      }
    });
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

/** מסנן וממיין רשימה לפי החיפוש, מהמתאים ביותר */
export function searchItems<T>(items: T[], query: string, fieldsOf: (item: T) => SearchFields): T[] {
  if (!normalize(query)) return items;
  return items
    .map((item) => ({ item, score: matchScore(fieldsOf(item), query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
