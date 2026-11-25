/**
 * הודעת שגיאה שמותר להציג למשתמש: רק הודעות שלנו (בעברית). שגיאה פנימית של הדפדפן או של ספרייה
 * (באנגלית, עם פרטים טכניים) מוחלפת בהודעה כללית.
 */
export function userMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return /[֐-׿]/.test(message) && message.length <= 200 ? message : fallback;
}
