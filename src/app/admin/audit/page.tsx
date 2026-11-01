import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { AUDIT_LABEL } from "@/lib/audit";
import { db } from "@/lib/db";

const GROUPS: { key: string; label: string; actions: string[] }[] = [
  { key: "all", label: "הכל", actions: [] },
  { key: "logins", label: "כניסות", actions: ["login.success", "login.failed", "login.blocked", "register"] },
  { key: "prices", label: "מחירים", actions: ["price.changed", "price.held", "price.approved", "price.rejected"] },
  {
    key: "admin",
    label: "פעולות אדמין",
    actions: [
      "supplier.status",
      "product.updated",
      "product.merged",
      "category.created",
      "category.renamed",
      "category.deleted",
      "review.status",
      "report.closed",
      "invoices.purged",
    ],
  },
  { key: "teams", label: "צוותים ופרטי עסק", actions: ["team.added", "team.updated", "business.updated"] },
];

function detailsText(details: unknown) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ group?: string; q?: string }> }) {
  await requireRole("ADMIN");
  const { group: groupKey, q = "" } = await searchParams;
  const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];
  const term = q.trim();
  const entries = await db.auditLog.findMany({
    where: {
      ...(group.actions.length ? { action: { in: group.actions } } : {}),
      ...(term ? { OR: [{ actor: { contains: term, mode: "insensitive" } }, { ip: term }, { targetId: term }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const failedLogins = await db.auditLog.count({
    where: { action: { in: ["login.failed", "login.blocked"] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">יומן פעולות</h1>
        <p className="text-sm text-muted">
          מי עשה מה ומתי: כניסות, הרשמות, שינויי מחיר ופעולות ניהול. היומן לא נמחק מהממשק. מוצגות 200 הרשומות האחרונות.
        </p>
        {failedLogins > 0 && (
          <p className="mt-2 text-sm text-danger">{failedLogins} ניסיונות כניסה שנכשלו ב-24 השעות האחרונות.</p>
        )}
      </div>
      <nav aria-label="סינון" className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={`/admin/audit?group=${g.key}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
            aria-current={g.key === group.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${g.key === group.key ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
          >
            {g.label}
          </Link>
        ))}
      </nav>
      <form className="flex gap-2">
        <input type="hidden" name="group" value={group.key} />
        <input
          name="q"
          defaultValue={term}
          placeholder="חיפוש לפי שם, אימייל או כתובת IP"
          aria-label="חיפוש ביומן"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">חיפוש</button>
      </form>
      <section className="rounded-lg border border-border bg-surface p-2">
        {entries.length === 0 ? (
          <p className="p-3 text-sm text-muted">אין רשומות.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <p>
                  <span
                    className={`font-medium ${e.action === "login.failed" || e.action === "login.blocked" ? "text-danger" : ""}`}
                  >
                    {AUDIT_LABEL[e.action] ?? e.action}
                  </span>
                  {e.actor && <span className="text-muted"> · {e.actor}</span>}
                </p>
                {detailsText(e.details) && <p className="break-words text-xs text-muted">{detailsText(e.details)}</p>}
                <p className="text-xs text-muted">
                  {e.createdAt.toLocaleString("he-IL")}
                  {e.ip && <span dir="ltr"> · {e.ip}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
