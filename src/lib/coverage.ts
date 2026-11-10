import { db } from "@/lib/db";
import { servesCustomer, type Point } from "@/lib/geo";
import { geocodeCity } from "@/lib/geocode";

export interface CoverageCustomer {
  id: string;
  regionId: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

/** מיקום הלקוח על המפה. לקוח שעוד לא אותר מאותר לפי העיר שלו ונשמר; null כשלא נמצא */
export async function customerPoint(customer: CoverageCustomer): Promise<Point | null> {
  if (customer.lat != null && customer.lng != null) return { lat: customer.lat, lng: customer.lng };
  const point = await geocodeCity(customer.city);
  if (point) {
    await db.customer.update({ where: { id: customer.id }, data: point });
    customer.lat = point.lat;
    customer.lng = point.lng;
  }
  return point;
}

/**
 * הספקים המאושרים שמגיעים ללקוח: לפי אזורי החלוקה שסימנו על המפה,
 * ולספקים בלי אזורים על המפה לפי האזור הכללי.
 */
export async function servingSupplierIds(customer: CoverageCustomer): Promise<string[]> {
  const [point, suppliers] = await Promise.all([
    customerPoint(customer),
    db.supplier.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        deliveryAreas: { select: { lat: true, lng: true, radiusKm: true } },
        deliveryZones: { select: { regionId: true } },
      },
    }),
  ]);
  return suppliers
    .filter((s) =>
      servesCustomer(
        { areas: s.deliveryAreas, regionIds: s.deliveryZones.map((z) => z.regionId) },
        { regionId: customer.regionId, point },
      ),
    )
    .map((s) => s.id);
}
