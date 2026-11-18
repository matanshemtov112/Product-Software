import { DENIED, type Permission } from "@/lib/auth/permissions";

/**
 * עוטף כפתור או טופס שדורש הרשאה. אזור הלקוח והספק מסמנים אילו הרשאות חסרות לעובד (data-lacks),
 * וה-CSS מסתיר את מה שהוא לא יכול להשתמש בו. השרת בודק בכל מקרה, זה רק כדי לא להציג כפתור שלא עובד.
 * עם note: במקום מה שהוסתר מופיע הסבר למה.
 */
export function Needs({ p, note, children }: { p: Permission; note?: boolean | string; children: React.ReactNode }) {
  return (
    <>
      <div data-needs={p} className="contents">
        {children}
      </div>
      {note && (
        <p data-needs-note={p} className="rounded-md border border-border bg-background px-4 py-3 text-sm text-muted">
          {typeof note === "string" ? note : DENIED[p]}
        </p>
      )}
    </>
  );
}
