import { db } from "@/lib/db";
import type { CustomerProfileSnapshot } from "@/lib/inquiries";
import { volumeRangeFor } from "./volume";

/** כל הפרטים שהלקוח מסר בהרשמה ובסל, כפי שנשלחים לספק עם הודעה */
export async function customerProfile(
  customerId: string,
  basket: { name: string; deliveriesPerMonth: number; monthlyVolumeMinAgorot: number | null; items: unknown[] },
): Promise<CustomerProfileSnapshot> {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: { region: true, users: { select: { name: true, email: true, phone: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const contact = customer.users[0];
  return {
    businessName: customer.businessName,
    businessType: customer.businessType,
    cuisine: customer.cuisine,
    city: customer.city,
    region: customer.region.name,
    contactName: contact?.name ?? null,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    monthlyVolume: volumeRangeFor(basket.monthlyVolumeMinAgorot)?.label ?? null,
    deliveriesPerMonth: basket.deliveriesPerMonth,
    basketName: basket.name,
    itemCount: basket.items.length,
    customerSince: customer.createdAt.toLocaleDateString("he-IL"),
  };
}
