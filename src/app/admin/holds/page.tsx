import Link from "next/link";
import { ConfirmForm } from "@/components/confirm-form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { HOLD_DAYS, HOLD_STATE_LABEL, holdState, paymentsProvider } from "@/lib/payments/holds";
import { releaseHold } from "./actions";
import { CaptureFeeForm } from "./capture-form";

export default async function AdminHolds() {
  await requireRole("ADMIN");
  const holds = await db.cardHold.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { businessName: true } },
      inquiry: { select: { supplier: { select: { companyName: true } } } },
    },
  });
  const provider = paymentsProvider();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מסגרות אשראי</h1>
        <p className="text-sm text-muted">
          עסק שמקבל הצעה מאשר את ההזמנה הראשונה במסגרת אשראי. המסגרת משתחררת כשהספק מאשר שההזמנה סופקה, או פגה אחרי{" "}
          {HOLD_DAYS} ימים. כאן אפשר לשחרר מסגרת, או לגבות דמי אי-הזמנה כשהלקוח קיבל הצעה ולא הזמין.
        </p>
        <p className="mt-1 text-xs text-muted">
          חברת סליקה:{" "}
          {provider === "demo"
            ? "מצב הדגמה (בלי חיוב אמיתי)"
            : (provider ?? "לא מוגדרת, ולכן קבלת הצעה לא דורשת אשראי")}
        </p>
      </div>
      {holds.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">עדיין אין מסגרות.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {holds.map((h) => {
            const state = holdState(h);
            return (
              <li key={h.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <strong>{h.customer.businessName}</strong> ← {h.inquiry.supplier.companyName} ·{" "}
                    {shekels(h.amountAgorot)}
                    {h.cardLast4 && <span className="text-muted"> · כרטיס {h.cardLast4}••••</span>}
                  </p>
                  <span className="rounded bg-background px-2 py-0.5 text-xs">
                    {HOLD_STATE_LABEL[state]}
                    {state === "captured" && h.capturedAgorot ? ` (${shekels(h.capturedAgorot)})` : ""}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {h.createdAt.toLocaleDateString("he-IL")}
                  {h.expiresAt && state === "active" ? ` · תפוסה עד ${h.expiresAt.toLocaleDateString("he-IL")}` : ""}
                  {h.failureReason ? ` · ${h.failureReason}` : ""} ·{" "}
                  <Link href={`/admin/audit?target=${h.inquiryId}`} className="underline">
                    יומן
                  </Link>
                </p>
                {state === "active" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <ConfirmForm
                      action={releaseHold}
                      fields={{ id: h.id }}
                      confirm="לשחרר את המסגרת?"
                      className="text-sm text-accent hover:underline"
                    >
                      שחרור המסגרת
                    </ConfirmForm>
                    <CaptureFeeForm id={h.id} maxShekels={h.amountAgorot / 100} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
