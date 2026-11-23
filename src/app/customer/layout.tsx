import { closeUnanswered } from "@/lib/inquiry-deadlines";
import { requireRole } from "@/lib/auth/current";
import { kickNotificationJobs } from "@/lib/notify/jobs";
import { teamRoleOf } from "@/lib/auth/permission-check";
import { lacking, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/permissions";
import { customerForUser } from "@/lib/customer/quotes";
import { CUISINES } from "@/lib/customer/templates";
import { lastFullMonth } from "@/lib/customer/monthly-report";
import { db } from "@/lib/db";
import { visibleFilter } from "@/lib/notify/prefs";
import { notify } from "@/lib/notifications";
import { CuisinePicker } from "./cuisine-picker";
import { CustomerSidebar } from "./sidebar";
import { switchSide } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("CUSTOMER");
  kickNotificationJobs();
  const customer = await customerForUser(session.userId);
  // פניות שהספק לא ענה עליהן תוך 3 ימים נסגרות, והלקוח רואה את זה
  await closeUnanswered({ customerId: customer.id });

  // הגדרה ראשונה: לפני שנבחר סוג המסעדה רואים רק את מסך הבחירה
  if (!customer.cuisine) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-muted">ברוכים הבאים, {customer.businessName}</p>
          <h1 className="text-2xl font-bold">איזו מסעדה אתם?</h1>
          <p className="text-sm text-muted">
            לפי סוג המסעדה נציע לכם רשימת מוצרים סטנדרטית, אם עוד אין לכם רשימה משלכם.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <CuisinePicker cuisines={[...CUISINES]} initial={null} submitLabel="המשך" next="new" />
        </div>
      </div>
    );
  }

  // כשחודש נגמר, הלקוח מקבל התראה שהדוח שלו מוכן (פעם אחת לכל חודש)
  const reportMonth = lastFullMonth(customer.createdAt);
  if (reportMonth) {
    await notify([
      {
        customerId: customer.id,
        kind: "MONTHLY_REPORT",
        title: `הדוח החודשי ל${reportMonth.label} מוכן`,
        body: "מה בדקנו בשבילכם, אילו מחירים עלו וירדו, וכמה אפשר לחסוך.",
        href: `/customer/reports/${reportMonth.key}`,
        dedupeKey: `monthly-report:${customer.id}:${reportMonth.key}`,
      },
    ]);
  }

  const [saved, inquiryReplies, matchReplies, reviewsAboutMe, unread] = await Promise.all([
    db.basket.findMany({
      where: { customerId: customer.id, savedAt: { not: null } },
      select: { id: true, name: true, runs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { savedAt: "asc" },
    }),
    db.negotiationRequest.count({
      where: { customerId: customer.id, status: { in: ["OFFERED", "CLOSED"] }, customerHiddenAt: null },
    }),
    db.matchRequest.count({ where: { customerId: customer.id, status: "ANSWERED", customerHiddenAt: null } }),
    db.customerReview.count({ where: { customerId: customer.id } }),
    db.notification.count({
      where: { customerId: customer.id, read: false, ...(await visibleFilter(session.userId)) },
    }),
  ]);

  const teamRole = await teamRoleOf(session.userId);

  return (
    <div data-lacks={lacking(teamRole)} className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="rounded-lg border border-border bg-surface p-2 md:sticky md:top-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:w-60 md:shrink-0">
        <CustomerSidebar
          businessName={customer.businessName}
          cuisine={customer.cuisine}
          saved={saved.map((b) => ({ id: b.id, name: b.name, lastCheck: b.runs[0]?.createdAt.toISOString() ?? null }))}
          replies={inquiryReplies + matchReplies}
          reviewsAboutMe={reviewsAboutMe}
          unread={unread}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {customer.ownerSupplierId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent bg-accent-soft px-4 py-2 text-sm">
            <span>
              אתם בצד הקנייה של <span className="font-medium">{customer.businessName}</span>: קונים מספקים אחרים כמו כל
              עסק.
            </span>
            <form action={switchSide}>
              <button className="rounded-full border border-accent bg-surface px-3 py-1 font-medium text-accent hover:bg-background">
                חזרה לצד הספק
              </button>
            </form>
          </div>
        )}
        {teamRole && teamRole !== "MANAGER" && ROLE_DESCRIPTION.CUSTOMER[teamRole] && (
          <p data-role-note className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-muted">
            אתם מחוברים בתפקיד <span className="font-medium text-foreground">{ROLE_LABEL[teamRole]}</span>:{" "}
            {ROLE_DESCRIPTION.CUSTOMER[teamRole]}.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
