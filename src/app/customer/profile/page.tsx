import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { CUISINES } from "@/lib/customer/templates";
import { volumeRangeFor } from "@/lib/customer/volume";
import { CuisinePicker } from "../cuisine-picker";
import { BusinessForm } from "./business-form";

export default async function CustomerProfile() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">פרטי העסק</h1>
        <p className="text-sm text-muted">
          {customer.businessName} · {customer.businessType} · {customer.region.name}
        </p>
      </div>
      <Card title="כתובת והיקף רכש">
        <BusinessForm
          city={customer.city}
          address={customer.address ?? ""}
          totalVolume={volumeRangeFor(customer.totalVolumeMinAgorot)?.key ?? ""}
        />
      </Card>
      <Card title="סוג המסעדה">
        <p className="mb-3 text-sm text-muted">סוג המסעדה קובע את רשימת המוצרים הסטנדרטית שמוצעת בבדיקה חדשה.</p>
        <CuisinePicker cuisines={[...CUISINES]} initial={customer.cuisine} submitLabel="שמירה" />
      </Card>
    </div>
  );
}
