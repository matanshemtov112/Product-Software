import type { ReviewStatus } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { setReviewStatus } from "../actions";

const LABEL: Record<ReviewStatus, string> = { PENDING: "ממתינות", PUBLISHED: "פורסמו", REJECTED: "נדחו" };
const FILTERS: ReviewStatus[] = ["PENDING", "PUBLISHED", "REJECTED"];

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as ReviewStatus) ? (status as ReviewStatus) : "PENDING";
  const reviews = await db.review.findMany({
    where: { status: filter },
    include: { customer: { select: { businessName: true } }, supplier: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ביקורות</h1>
        <p className="text-sm text-muted">
          ביקורות של לקוחות על ספקים. ביקורת שפורסמה מופיעה ללקוחות ונכנסת לדירוג של הספק.
        </p>
      </div>
      <nav aria-label="סינון" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/reviews?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${f === filter ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
          >
            {LABEL[f]}
          </Link>
        ))}
      </nav>
      {reviews.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">אין ביקורות ברשימה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm">
                <span className="font-medium">{r.customer.businessName}</span> על{" "}
                <span className="font-medium">{r.supplier.companyName}</span> ·{" "}
                <span aria-label={`${r.overall} מתוך 5`}>{"★".repeat(r.overall)}</span> ·{" "}
                <span className="text-muted">{r.createdAt.toLocaleDateString("he-IL")}</span>
              </p>
              {r.text && <p className="text-sm whitespace-pre-line">{r.text}</p>}
              <form action={setReviewStatus} className="flex gap-2">
                <input type="hidden" name="reviewId" value={r.id} />
                {r.status !== "PUBLISHED" && (
                  <button
                    name="status"
                    value="PUBLISHED"
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  >
                    פרסום
                  </button>
                )}
                {r.status !== "REJECTED" && (
                  <button
                    name="status"
                    value="REJECTED"
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                  >
                    {r.status === "PUBLISHED" ? "הסרה" : "דחייה"}
                  </button>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
