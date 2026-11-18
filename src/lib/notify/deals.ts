import { db } from "@/lib/db";
import { servesCustomer } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { weekKey } from "./jobs";

/**
 * הודעה שיווקית: מבצע כמות חדש על מוצר שהמסעדה קונה, אצל ספק שמגיע אליה.
 * נשלחת רק למי שבחר לקבל הודעות שיווקיות, ולכל היותר פעם בשבוע מכל ספק לכל מסעדה.
 */
export async function notifyNewDeal(supplierId: string, productId: string, productName: string, now = new Date()) {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: {
      companyName: true,
      status: true,
      deliveryAreas: { select: { lat: true, lng: true, radiusKm: true } },
      deliveryZones: { select: { regionId: true } },
    },
  });
  if (!supplier || supplier.status !== "APPROVED") return;
  const items = await db.basketItem.findMany({
    where: { productId, basket: { currentSupplierId: { not: supplierId } } },
    select: {
      basket: { select: { id: true, customer: { select: { id: true, regionId: true, lat: true, lng: true } } } },
    },
  });
  const coverage = { areas: supplier.deliveryAreas, regionIds: supplier.deliveryZones.map((z) => z.regionId) };
  const week = weekKey(now);
  const seen = new Set<string>();
  await notify(
    items.flatMap(({ basket }) => {
      const c = basket.customer;
      if (seen.has(c.id)) return [];
      seen.add(c.id);
      const point = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
      if (!servesCustomer(coverage, { regionId: c.regionId, point })) return [];
      return [
        {
          customerId: c.id,
          aboutSupplierId: supplierId,
          kind: "NEW_DEAL" as const,
          title: `מבצע חדש של ${supplier.companyName} על ${productName}`,
          body: "מוצר שנמצא בסל שלכם. הפרטים בדף המבצעים.",
          href: "/customer/deals",
          dedupeKey: `deal:${supplierId}:${c.id}:${week}`,
        },
      ];
    }),
  );
}
