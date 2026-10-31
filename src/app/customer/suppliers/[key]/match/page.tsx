import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { MATCH_STATUS_LABEL, matchCandidates, OPEN_MATCH } from "@/lib/matches";
import { MatchForm, MatchMessage } from "./match-form";

export default async function MatchRequestPage({ params }: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await params).key);
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const supplier = (await mySuppliers(customer.id)).find((s) => s.key === key);
  if (!supplier) notFound();
  const candidates = matchCandidates(supplier.lines);
  const open = supplier.supplierId
    ? await db.matchRequest.findFirst({
        where: { customerId: customer.id, supplierId: supplier.supplierId, status: { in: OPEN_MATCH } },
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/customer/suppliers/${encodeURIComponent(supplier.key)}`}
          className="text-sm text-muted hover:text-foreground"
        >
          → חזרה ל{supplier.name}
        </Link>
        <h1 className="text-2xl font-bold">בקשה מ{supplier.name} להשוות מחירים</h1>
        <p className="text-sm text-muted">
          לפעמים הדרך הכי קלה לחסוך היא לבקש מהספק שלכם להשוות. הספק רואה את המחיר הזול שמצאנו, בלי השם של הספק שמציע
          אותו. כל המחירים ללא מע״מ.
        </p>
      </div>

      <Card title="המוצרים שאפשר לבקש עליהם השוואה">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">
            לא מצאנו במערכת מחיר זול יותר ממה שאתם משלמים היום ל{supplier.name}. אין מה לבקש כרגע.
          </p>
        ) : open ? (
          <p className="text-sm">
            כבר שלחתם בקשה ל{supplier.name} ב-{open.createdAt.toLocaleDateString("he-IL")} (
            {MATCH_STATUS_LABEL[open.status]}).{" "}
            <Link href={`/customer/matches/${open.id}`} className="text-accent">
              לבקשה
            </Link>
          </p>
        ) : supplier.supplierId ? (
          <>
            <p className="mb-3 text-sm text-muted">
              {supplier.name} רשום במערכת. הבקשה תגיע אליו, והוא יוכל להשוות, להציע מחיר אחר או לסרב על כל מוצר. התשובה
              תופיע אצלכם בפניות לספקים.
            </p>
            <MatchForm supplierKey={supplier.key} supplierName={supplier.name} candidates={candidates} />
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              {supplier.name} לא רשום במערכת, אז הכנו לכם הודעה מוכנה. סמנו את המוצרים ושלחו לו בוואטסאפ או העתיקו
              למייל.
            </p>
            <MatchMessage businessName={customer.businessName} candidates={candidates} />
          </>
        )}
      </Card>
    </div>
  );
}
