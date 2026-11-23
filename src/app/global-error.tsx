"use client";

/** שגיאה בשלד האתר עצמו: דף מינימלי בלי פרטים פנימיים */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "3rem 1rem" }}>
        <h1>משהו השתבש</h1>
        <p>נסו לרענן את הדף בעוד רגע.</p>
        {error.digest && <p style={{ fontSize: 12, color: "#666" }}>קוד לתמיכה: {error.digest}</p>}
      </body>
    </html>
  );
}
