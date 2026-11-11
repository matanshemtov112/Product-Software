import { db } from "@/lib/db";
import { distanceKm, servesCustomer, type Point } from "@/lib/geo";
import { areaTermsText } from "@/lib/terms";
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

/**
 * תנאי האספקה של ספק ללקוח: לפי אזור החלוקה על המפה שהעסק נמצא בו (הקטן ביותר אם יש כמה),
 * ואם לאזור אין תנאים או שהלקוח לא אותר, תנאי האספקה הכלליים של הספק.
 */
export async function deliveryTermsFor(
  supplierId: string,
  customer: CoverageCustomer,
  general: string | null,
): Promise<string | null> {
  const point = await customerPoint(customer);
  if (point) {
    const areas = await db.deliveryArea.findMany({ where: { supplierId } });
    const inside = areas
      .filter((a) => distanceKm(a, point) <= a.radiusKm)
      .sort((a, b) => a.radiusKm - b.radiusKm)
      .map((a) => areaTermsText(a))
      .find((t) => t !== null);
    if (inside) return inside;
  }
  return general;
}
