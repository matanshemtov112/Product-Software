import { matchScore, tokens, type SearchFields } from "@/lib/search";

/**
 * הצעה למוצר מהקטלוג לשורה שהמודל לא התאים: המוצר שהכי הרבה מילים מהשורה מתאימות לו.
 * בניגוד לחיפוש הרגיל, לא כל מילה צריכה להתאים, כי בחשבונית יש גם אריזה, מותג ומידות.
 */
export function suggestProduct<T>(text: string, items: T[], fieldsOf: (item: T) => SearchFields): T | null {
  const words = tokens(text).filter((t) => t.length > 1 && !/\d/.test(t));
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const fields = fieldsOf(item);
    const score = words.reduce((sum, w) => sum + matchScore(fields, w), 0);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
