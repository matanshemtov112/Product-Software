import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { lastFullMonth, reportMonths } from "@/lib/customer/monthly-report";
import { customerForUser } from "@/lib/customer/quotes";

/** הדוח האחרון שהסתיים, או החודש הנוכחי ללקוח שנרשם החודש */
export default async function Reports() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const month = lastFullMonth(customer.createdAt) ?? reportMonths(customer.createdAt)[0];
  redirect(`/customer/reports/${month.key}`);
}
