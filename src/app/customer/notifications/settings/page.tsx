import { Card } from "@/components/form";
import { NotificationSettings } from "@/components/notifications/settings-page";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { updateSupplierBlock } from "../../blocks/actions";

export default async function CustomerNotificationSettings() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const [user, blocks] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { email: true } }),
    db.supplierBlock.findMany({
      where: { customerId: customer.id },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <NotificationSettings userId={session.userId} email={user.email} org="CUSTOMER">
      <Card title="ספקים שהשתקתם או חסמתם">
        <p className="mb-3 text-sm text-muted">
          השתקה: לא תקבלו התראות על המחירים והמבצעים של הספק, אבל תשובות לפניות שלכם יגיעו. חסימה: הספק לא יופיע
          בהשוואות שלכם ולא יוכל לענות לכם. הספק לא יודע שהשתקתם או חסמתם אותו. משתיקים או חוסמים מדף הספק.
        </p>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">אין ספקים מושתקים או חסומים.</p>
        ) : (
          <ul data-blocks className="divide-y divide-border text-sm">
            {blocks.map((b) => (
              <li key={b.supplierId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {b.supplier.companyName} <span className="text-muted">({b.mode === "BLOCK" ? "חסום" : "מושתק"})</span>
                </span>
                <form action={updateSupplierBlock} data-needs="buy">
                  <input type="hidden" name="supplierId" value={b.supplierId} />
                  <input type="hidden" name="back" value="/customer/notifications/settings" />
                  <button name="mode" value="NONE" className="text-accent hover:underline">
                    {b.mode === "BLOCK" ? "ביטול החסימה" : "ביטול ההשתקה"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </NotificationSettings>
  );
}
