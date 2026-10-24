import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { CUISINES } from "@/lib/customer/templates";
import { CuisinePicker } from "../cuisine-picker";

export default async function CustomerProfile() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">סוג המסעדה</h1>
        <p className="text-sm text-muted">
          {customer.businessName} · {customer.city} · {customer.region.name}. סוג המסעדה קובע את רשימת המוצרים הסטנדרטית
          שמוצעת בבדיקה חדשה.
        </p>
      </div>
      <Card>
        <CuisinePicker cuisines={[...CUISINES]} initial={customer.cuisine} submitLabel="שמירה" />
      </Card>
    </div>
  );
}
