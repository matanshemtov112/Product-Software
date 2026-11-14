import type { DocumentStatus } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { DOC_LABEL, DOC_STATUS_LABEL, isVerified, requiredDocs } from "@/lib/verification";
import { reviewDocument } from "../actions";

const FILTERS: DocumentStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function AdminVerification({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as DocumentStatus) ? (status as DocumentStatus) : "PENDING";
  const docs = await db.supplierDocument.findMany({
    where: { status: filter },
    select: {
      id: true,
      kind: true,
      fileName: true,
      size: true,
      validUntil: true,
      rejectReason: true,
      updatedAt: true,
      supplier: {
        select: {
          companyName: true,
          companyNumber: true,
          isManufacturer: true,
          verifiedAt: true,
          verifiedUntil: true,
        },
      },
    },
    orderBy: { updatedAt: filter === "PENDING" ? "asc" : "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">אימות ספקים</h1>
        <p className="text-sm text-muted">
          ספק מאומת אחרי שכל המסמכים הנדרשים אושרו: תעודת עוסק לכל ספק, ולמפעל שמייצר גם רישיון יצרן ואישור משרד
          הבריאות. כשתוקף של מסמך עובר, הספק חוזר אוטומטית ל״טרם אומת״. בדקו שהשם והח.פ. במסמך תואמים לחשבון.
        </p>
      </div>
      <nav aria-label="סינון" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/verification?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${f === filter ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
          >
            {DOC_STATUS_LABEL[f]}
          </Link>
        ))}
      </nav>
      {docs.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">אין מסמכים ברשימה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.supplier.companyName}</span>
                <span className="text-muted">ח.פ. {d.supplier.companyNumber}</span>
                <span className="text-muted">· {d.supplier.isManufacturer ? "מפעל" : "ספק / משווק"}</span>
                {isVerified(d.supplier) && (
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-xs text-accent">מאומת</span>
                )}
              </p>
              <p>
                <strong>{DOC_LABEL[d.kind]}</strong> ·{" "}
                <a
                  href={`/api/supplier-documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {d.fileName}
                </a>{" "}
                <span className="text-muted">
                  ({Math.max(1, Math.round(d.size / 1024))}KB · הועלה {d.updatedAt.toLocaleDateString("he-IL")})
                </span>
              </p>
              <p className="text-xs text-muted">
                נדרש מ
                {requiredDocs(d.supplier.isManufacturer).includes(d.kind)
                  ? "הספק הזה"
                  : "מפעלים בלבד (לא חובה לספק הזה)"}
              </p>
              {d.rejectReason && <p className="text-danger">סיבת הדחייה: {d.rejectReason}</p>}
              <form action={reviewDocument} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <input type="hidden" name="documentId" value={d.id} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">תוקף המסמך</span>
                  <input
                    type="date"
                    name="validUntil"
                    defaultValue={dateInput(d.validUntil)}
                    className="rounded-md border border-border bg-surface px-3 py-2"
                  />
                </label>
                <input
                  name="reason"
                  placeholder="סיבת דחייה (הספק יראה)"
                  aria-label="סיבת דחייה"
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2"
                />
                <button
                  name="decision"
                  value="APPROVED"
                  className="rounded-md bg-accent px-4 py-2 font-medium text-white"
                >
                  אישור המסמך
                </button>
                <button name="decision" value="REJECTED" className="rounded-md border border-border px-4 py-2">
                  דחייה
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
