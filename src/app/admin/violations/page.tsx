import type { ViolationStatus } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import {
  reportsToNextStage,
  STAGE_LABEL,
  VIOLATION_THRESHOLDS,
  VIOLATION_WINDOW_DAYS,
  violationStage,
  windowStart,
} from "@/lib/price-violations";
import { reviewViolation } from "../actions";

const FILTERS: { status: ViolationStatus; label: string }[] = [
  { status: "OPEN", label: "חדשים" },
  { status: "CONFIRMED", label: "מוצדקים" },
  { status: "DISMISSED", label: "בוטלו" },
];

const STAGE_STYLE = [
  "bg-background text-muted",
  "bg-[#fff4c2] text-[#6b5500]",
  "bg-[#ffe4cc] text-[#8a3b00]",
  "bg-[#fde2e1] text-danger",
  "bg-danger text-white",
];

const pct = (shown: number, charged: number) => Math.round(((charged - shown) / shown) * 100);

export default async function AdminViolations({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; supplier?: string }>;
}) {
  await requireRole("ADMIN");
  const { status, supplier } = await searchParams;
  const filter = FILTERS.find((f) => f.status === status)?.status ?? "OPEN";
  const since = windowStart();

  const [active, reports, suppliers] = await Promise.all([
    db.priceViolationReport.groupBy({
      by: ["supplierId"],
      where: { status: { not: "DISMISSED" }, createdAt: { gte: since } },
      _count: true,
    }),
    db.priceViolationReport.findMany({
      where: { status: filter, ...(supplier ? { supplierId: supplier } : {}) },
      include: { supplier: { select: { companyName: true } }, customer: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.supplier.findMany({
      where: { OR: [{ violationStage: { gt: 0 } }, { priceViolations: { some: { createdAt: { gte: since } } } }] },
      select: { id: true, companyName: true, violationStage: true, status: true, reliability: true },
    }),
  ]);
  const countOf = (id: string) => active.find((a) => a.supplierId === id)?._count ?? 0;
  const ranked = suppliers.map((s) => ({ ...s, count: countOf(s.id) })).sort((a, b) => b.count - a.count);
  const filterHref = (f: ViolationStatus) => `/admin/violations?status=${f}${supplier ? `&supplier=${supplier}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">הפרות מחיר</h1>
        <p className="text-sm text-muted">
          לקוחות מדווחים כשספק גבה מחיר גבוה מהמחיר במערכת. נספרים דיווחים מ-{VIOLATION_WINDOW_DAYS} הימים האחרונים, חוץ
          מדיווחים שביטלתם. השלבים: {VIOLATION_THRESHOLDS[0]} דיווחים לבדיקה, {VIOLATION_THRESHOLDS[1]} הודעה לספק,{" "}
          {VIOLATION_THRESHOLDS[2]} ירידה באמינות, {VIOLATION_THRESHOLDS[3]} השעיה. ביטול דיווח מחזיר את הספק לשלב
          המתאים, כולל הסרת השעיה.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold">ספקים עם דיווחים</h2>
        {ranked.length === 0 ? (
          <p className="p-4 text-sm text-muted">אין דיווחים על ספקים.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ranked.map((s) => {
              const stage = violationStage(s.count);
              const next = reportsToNextStage(s.count);
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/violations?status=${filter}&supplier=${s.id}`}
                    className={`flex flex-col gap-1 px-4 py-3 text-sm hover:bg-background sm:flex-row sm:items-center sm:justify-between ${supplier === s.id ? "bg-accent-soft" : ""}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.companyName}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STAGE_STYLE[stage]}`}>
                        שלב {stage}: {STAGE_LABEL[stage]}
                      </span>
                      {s.status === "SUSPENDED" && <span className="text-xs text-danger">מושעה</span>}
                    </span>
                    <span className="text-muted">
                      <strong className="text-foreground">{s.count}</strong> דיווחים פעילים
                      {next !== null && ` · עוד ${next} לשלב הבא`} · אמינות {Math.round(s.reliability * 100)}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav aria-label="סינון" className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.status}
            href={filterHref(f.status)}
            aria-current={f.status === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${f.status === filter ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
          >
            {f.label}
          </Link>
        ))}
        {supplier && (
          <Link href={`/admin/violations?status=${filter}`} className="text-sm text-muted underline">
            כל הספקים
          </Link>
        )}
      </nav>

      {reports.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">אין דיווחים ברשימה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
              <p>
                <span className="font-medium">{r.customer.businessName}</span> דיווחו על{" "}
                <span className="font-medium">{r.supplier.companyName}</span> ·{" "}
                <span className="text-muted">{r.createdAt.toLocaleString("he-IL")}</span>
              </p>
              <p>
                <strong>{r.productName}</strong>: במערכת {shekels(r.shownPriceAgorot, 2)}, נגבה{" "}
                <strong className="text-danger">{shekels(r.chargedPriceAgorot, 2)}</strong> ל{r.unit} (
                {pct(r.shownPriceAgorot, r.chargedPriceAgorot)}% יותר) · אספקה מ-
                {r.occurredOn.toLocaleDateString("he-IL")}
              </p>
              {r.text && <p className="whitespace-pre-line text-muted">{r.text}</p>}
              {r.adminNote && <p className="text-xs text-muted">הערה שלכם: {r.adminNote}</p>}
              <form action={reviewViolation} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="hidden" name="reportId" value={r.id} />
                {r.status !== "OPEN" ? (
                  <button name="status" value="OPEN" className="self-start text-sm text-muted underline">
                    החזרה לחדשים
                  </button>
                ) : (
                  <>
                    <input
                      name="note"
                      placeholder="הערה פנימית (לא חובה)"
                      aria-label="הערה פנימית"
                      className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2"
                    />
                    <button
                      name="status"
                      value="CONFIRMED"
                      className="rounded-md bg-accent px-4 py-2 font-medium text-white"
                    >
                      מוצדק
                    </button>
                    <button name="status" value="DISMISSED" className="rounded-md border border-border px-4 py-2">
                      ביטול הדיווח
                    </button>
                  </>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
