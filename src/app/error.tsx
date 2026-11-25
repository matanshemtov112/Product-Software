"use client";

/** דף שגיאה כללי: בלי פרטים פנימיים. הפרטים נרשמים בשרת, והמשתמש מקבל קוד קצר למסירה לתמיכה */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-10 text-center">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="text-sm text-muted">לא הצלחנו להציג את הדף. נסו שוב בעוד רגע.</p>
      {error.digest && <p className="text-xs text-muted">קוד לתמיכה: {error.digest}</p>}
      <button onClick={reset} className="mx-auto rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
        ניסיון נוסף
      </button>
    </div>
  );
}
