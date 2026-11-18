import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

const STATUS = { QUEUED: "ממתין", SENT: "נשלח", FAILED: "נכשל", SKIPPED: "לא נשלח" } as const;
const KIND: Record<string, string> = { INSTANT: "מיידי", DAILY: "סיכום יומי", WEEKLY: "סיכום שבועי" };

const when = (d: Date) =>
  d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** כל האימיילים שהמערכת שלחה או ניסתה לשלוח */
export default async function AdminEmails() {
  await requireRole("ADMIN");
  const [messages, counts] = await Promise.all([
    db.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.emailMessage.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">אימיילים שנשלחו</h1>
        <p className="text-sm text-muted">
          התראות מיידיות וסיכומים יומיים ושבועיים, לפי מה שכל משתמש בחר.{" "}
          {counts.map((c) => `${STATUS[c.status]}: ${c._count}`).join(" · ")}
        </p>
      </div>
      {!emailConfigured() && (
        <p className="rounded-md border border-border bg-accent-soft px-4 py-3 text-sm">
          שירות האימייל עוד לא מוגדר (RESEND_API_KEY ו-EMAIL_FROM), ולכן ההודעות רק נרשמות כאן ולא יוצאות.
        </p>
      )}
      <Card>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">עוד לא נשלחו אימיילים.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {messages.map((m) => (
              <li key={m.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer flex-wrap gap-x-3">
                    <span className="w-24 shrink-0 text-muted tabular-nums">{when(m.createdAt)}</span>
                    <span className="font-medium">{m.subject}</span>
                    <span className="text-muted" dir="ltr">
                      {m.to}
                    </span>
                    <span className="text-muted">
                      {KIND[m.kind] ?? m.kind} · {STATUS[m.status]}
                    </span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-background p-3 font-sans text-sm">
                    {m.text}
                  </pre>
                  {m.error && <p className="mt-1 text-danger">{m.error}</p>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
