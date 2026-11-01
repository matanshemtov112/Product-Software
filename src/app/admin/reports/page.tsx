import type { ReportStatus } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { REPORT_REASON_LABEL, REPORT_STATUS_LABEL } from "@/lib/reports";
import { closeReport } from "../actions";

const FILTERS: ReportStatus[] = ["OPEN", "RESOLVED", "DISMISSED"];

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as ReportStatus) ? (status as ReportStatus) : "OPEN";
  const reports = await db.abuseReport.findMany({
    where: { status: filter },
    orderBy: { createdAt: filter === "OPEN" ? "asc" : "desc" },
    take: 100,
  });
  // כמה דיווחים פתוחים יש על כל אחד, כדי לזהות דפוס
  const counts = await db.abuseReport.groupBy({
    by: ["targetId"],
    where: { targetId: { in: reports.map((r) => r.targetId) } },
    _count: true,
  });
  const countOf = (id: string) => counts.find((c) => c.targetId === id)?._count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">דיווחים</h1>
        <p className="text-sm text-muted">
          לקוחות מדווחים על ספקים, וספקים על לקוחות שפנו אליהם. מי שדווח עליו לא רואה את הדיווח. ספק עם כמה דיווחים אפשר
          להשהות במסך הספקים.
        </p>
      </div>
      <nav aria-label="סינון" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/reports?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${f === filter ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
          >
            {REPORT_STATUS_LABEL[f]}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">אין דיווחים ברשימה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm">
                <span className="font-medium">{r.reporterName}</span> דיווח על{" "}
                <span className="font-medium">{r.targetName}</span> ({r.targetType === "SUPPLIER" ? "ספק" : "לקוח"}) ·{" "}
                <span className="text-muted">{r.createdAt.toLocaleString("he-IL")}</span>
              </p>
              <p className="text-sm">
                <span className="rounded bg-[#fbebeb] px-2 py-0.5 text-xs text-danger">
                  {REPORT_REASON_LABEL[r.reason]}
                </span>
                {countOf(r.targetId) > 1 && (
                  <span className="ms-2 text-xs text-danger">
                    {countOf(r.targetId)} דיווחים על {r.targetName}
                  </span>
                )}
              </p>
              {r.text && <p className="text-sm whitespace-pre-line">{r.text}</p>}
              {r.path && (
                <p className="text-xs text-muted" dir="ltr">
                  {r.path}
                </p>
              )}
              {r.status === "OPEN" ? (
                <form action={closeReport} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="hidden" name="reportId" value={r.id} />
                  <input
                    name="resolution"
                    placeholder="מה עשיתם (הערה פנימית)"
                    aria-label="הערה על הטיפול"
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-base outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <button
                      name="status"
                      value="RESOLVED"
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                    >
                      טופל
                    </button>
                    <button
                      name="status"
                      value="DISMISSED"
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                    >
                      סגירה בלי פעולה
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted">
                  {REPORT_STATUS_LABEL[r.status]} {r.resolvedAt?.toLocaleDateString("he-IL")}
                  {r.resolution && `: ${r.resolution}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
