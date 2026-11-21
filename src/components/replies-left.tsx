import { MAX_REPLIES } from "@/lib/notify/limits";

/** כמה תשובות נשארו לספק בפנייה הזו (כדי שלא יציף את הלקוח בעדכונים) */
export function RepliesLeft({ used }: { used: number }) {
  if (used === 0) return null;
  const left = Math.max(0, MAX_REPLIES - used);
  return (
    <p className="mb-3 text-sm text-muted">
      {left > 0
        ? `אפשר לעדכן את התשובה עוד ${left === 1 ? "פעם אחת" : `${left} פעמים`}.`
        : `שלחתם ${MAX_REPLIES} תשובות לפנייה הזו, וזה המקסימום. חכו שהלקוח יחליט או יפנה שוב.`}
    </p>
  );
}
