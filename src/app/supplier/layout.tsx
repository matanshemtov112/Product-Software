import { closeUnanswered, remindUnanswered } from "@/lib/inquiry-deadlines";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current";
import { kickNotificationJobs } from "@/lib/notify/jobs";
import { teamRoleOf } from "@/lib/auth/permission-check";
import { lacking, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/permissions";
import { categoryTree } from "@/lib/categories";
import { db } from "@/lib/db";
import { visibleFilter } from "@/lib/notify/prefs";
import { categoryCounts, supplierForUser } from "@/lib/supplier/catalog";
import { DomainPicker } from "./domain-picker";
import { SupplierSidebar } from "./sidebar";
import { ViolationNotice } from "./violation-notice";
import { isVerified } from "@/lib/verification";

export const dynamic = "force-dynamic";

const STATUS_NOTE = {
  PENDING: "החשבון ממתין לאישור צוות הפלטפורמה. אפשר כבר לבנות את רשימת המוצרים; היא תופיע בהשוואות אחרי האישור.",
  REJECTED: "החשבון לא אושר. לפרטים נא לפנות לצוות הפלטפורמה.",
  SUSPENDED:
    "החשבון מושעה, ולקוחות לא רואים אתכם בהשוואות. אם ההשעיה בגלל דיווחים על הפרת מחיר, עדכנו את המחירים, וצוות הפלטפורמה יבדוק.",
  APPROVED: null,
} as const;

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("SUPPLIER");
  kickNotificationJobs();
  const supplier = await supplierForUser(session.userId);
  // פניות שלא נענו: תזכורת אחרי 24 שעות, סגירה אחרי 3 ימים
  await closeUnanswered({ supplierId: supplier.id });
  await remindUnanswered(supplier.id);

  // הגדרה ראשונה: לפני שהספק בחר תחומים הוא רואה רק את מסך הבחירה, בכל עמוד באזור הספק
  if (!supplier.categoriesSetAt) {
    const tree = await categoryTree();
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-muted">ברוכים הבאים, {supplier.companyName}</p>
          <h1 className="text-2xl font-bold">באילו תחומים אתם עובדים?</h1>
          <p className="text-sm text-muted">
            נציג לכם רק את סוגי המוצרים מהתחומים שתבחרו. אפשר לשנות את זה בכל זמן בפרטי הפרופיל.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <DomainPicker tree={tree} initialIds={[]} initialAll={false} submitLabel="המשך לרשימת המוצרים" />
        </div>
      </div>
    );
  }

  const [categories, newInquiries, newMatches, unread, ratingAgg, areaCount, agreements] = await Promise.all([
    categoryCounts(supplier.id),
    db.negotiationRequest.count({ where: { supplierId: supplier.id, status: "SENT" } }),
    db.matchRequest.count({ where: { supplierId: supplier.id, status: "SENT" } }),
    db.notification.count({
      where: { supplierId: supplier.id, read: false, ...(await visibleFilter(session.userId)) },
    }),
    db.review.aggregate({
      where: { supplierId: supplier.id, status: "PUBLISHED" },
      _avg: { overall: true },
      _count: true,
    }),
    db.deliveryArea.count({ where: { supplierId: supplier.id } }),
    db.priceGuarantee.count({ where: { supplierId: supplier.id, guaranteedUntil: { gt: new Date() } } }),
  ]);
  const rating = ratingAgg._count ? { average: ratingAgg._avg.overall ?? 0, count: ratingAgg._count } : null;
  const total = categories.reduce((s, c) => s + c.count, 0);
  const note = STATUS_NOTE[supplier.status];

  const teamRole = await teamRoleOf(session.userId);

  return (
    <div data-lacks={lacking(teamRole)} className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="rounded-lg border border-border bg-surface p-2 md:sticky md:top-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:w-56 md:shrink-0">
        <Suspense>
          <SupplierSidebar
            categories={categories}
            total={total}
            newInquiries={newInquiries + newMatches}
            agreements={agreements}
            rating={rating}
            unread={unread}
          />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {teamRole && teamRole !== "MANAGER" && (
          <p data-role-note className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-muted">
            אתם מחוברים בתפקיד <span className="font-medium text-foreground">{ROLE_LABEL[teamRole]}</span>:{" "}
            {ROLE_DESCRIPTION.SUPPLIER[teamRole]}.
          </p>
        )}
        {note && <p className="rounded-md border border-border bg-accent-soft px-4 py-3 text-sm">{note}</p>}
        <ViolationNotice supplierId={supplier.id} stage={supplier.violationStage} />
        {areaCount === 0 && (
          <p className="rounded-md border border-border bg-accent-soft px-4 py-3 text-sm">
            עוד לא סימנתם את אזורי החלוקה שלכם.{" "}
            <Link href="/supplier/areas" className="font-medium text-accent underline">
              סמנו אותם על המפה
            </Link>{" "}
            כדי שלקוחות באזורים שלכם יראו אתכם בהשוואות.
          </p>
        )}
        {!isVerified(supplier) && (
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
            ללקוחות אתם מופיעים כרגע עם ״טרם אומת״.{" "}
            <Link href="/supplier/verification" className="font-medium text-accent underline">
              העלו את המסמכים לאימות
            </Link>{" "}
            כדי לקבל את התגית ״ספק מאומת ✓״.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
