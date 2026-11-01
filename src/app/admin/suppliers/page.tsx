import type { SupplierStatus } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { setSupplierStatus } from "../actions";

const LABEL: Record<SupplierStatus, string> = { PENDING: "ממתין לאישור", APPROVED: "מאושר", REJECTED: "לא אושר" };
const STYLE: Record<SupplierStatus, string> = {
  PENDING: "bg-[#fff4c2] text-[#6b5500]",
  APPROVED: "bg-accent-soft text-accent",
  REJECTED: "bg-background text-danger",
};
const FILTERS: (SupplierStatus | "ALL")[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];

function StatusButton({
  id,
  status,
  label,
  primary,
}: {
  id: string;
  status: SupplierStatus;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setSupplierStatus}>
      <input type="hidden" name="supplierId" value={id} />
      <button
        name="status"
        value={status}
        className={
          primary
            ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
            : "rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        }
      >
        {label}
      </button>
    </form>
  );
}

export default async function AdminSuppliers({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as SupplierStatus) ? (status as SupplierStatus) : undefined;
  const suppliers = await db.supplier.findMany({
    where: filter ? { status: filter } : {},
    include: {
      users: { select: { email: true, name: true, phone: true }, take: 1, orderBy: { createdAt: "asc" } },
      deliveryZones: { include: { region: true } },
      _count: { select: { offers: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ספקים</h1>
        <p className="text-sm text-muted">
          ספק חדש מופיע בהשוואות רק אחרי אישור. כדאי לבדוק את ח.פ. ואת פרטי הקשר לפני שמאשרים.
        </p>
      </div>
      <nav aria-label="סינון" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (f === "ALL" && !filter) || f === filter;
          return (
            <Link
              key={f}
              href={f === "ALL" ? "/admin/suppliers" : `/admin/suppliers?status=${f}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface"}`}
            >
              {f === "ALL" ? "הכל" : LABEL[f]}
            </Link>
          );
        })}
      </nav>
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted">אין ספקים ברשימה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suppliers.map((s) => {
            const contact = s.users[0];
            return (
              <li key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.companyName}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${STYLE[s.status]}`}>{LABEL[s.status]}</span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted">ח.פ.: </dt>
                    <dd className="inline">{s.companyNumber}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">נרשם: </dt>
                    <dd className="inline">{s.createdAt.toLocaleDateString("he-IL")}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">איש קשר: </dt>
                    <dd className="inline">
                      {contact
                        ? `${contact.name} · ${contact.email}${contact.phone ? ` · ${contact.phone}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">מוצרים: </dt>
                    <dd className="inline">{s._count.offers}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-muted">אזורי אספקה: </dt>
                    <dd className="inline">{s.deliveryZones.map((z) => z.region.name).join(", ") || "לא הוגדרו"}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {s.status !== "APPROVED" && <StatusButton id={s.id} status="APPROVED" label="אישור" primary />}
                  {s.status !== "REJECTED" && (
                    <StatusButton id={s.id} status="REJECTED" label={s.status === "APPROVED" ? "השהיה" : "דחייה"} />
                  )}
                  {s.status === "REJECTED" && <StatusButton id={s.id} status="PENDING" label="החזרה לבדיקה" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
