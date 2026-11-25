import { db } from "@/lib/db";
import { distanceKm, servesCustomer, type Point } from "@/lib/geo";
import { cache } from "react";
import { areaTermsText, deliveryFrequency, type DeliveryFrequency } from "@/lib/terms";
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
      // ספק שהעסק חסם לא מופיע לו בשום השוואה
      where: {
        status: "APPROVED",
        blockedBy: { none: { customerId: customer.id, mode: "BLOCK" } },
        // ספק שקונה דרך חשבון הקנייה שלו לא מופיע לעצמו
        OR: [{ buyingAccount: { is: null } }, { buyingAccount: { isNot: { id: customer.id } } }],
      },
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

/**
 * כמה פעמים בשבוע הספק מגיע ללקוח. ספק שבחר "מספר פעמים בשבוע" מוצג לפי המספר הזה;
 * אחרת לפי הימים הקבועים באזור החלוקה שהלקוח נמצא בו (העיגול הקטן ביותר על המפה שיש לו ימים,
 * ולספק בלי עיגולים, האזור הכללי של הלקוח).
 */
export const deliveryFrequencyFor = cache(
  async (supplierId: string, customer: CoverageCustomer): Promise<DeliveryFrequency | null> => {
    const s = await db.supplier.findUnique({
      where: { id: supplierId },
      select: {
        deliverySchedule: true,
        deliveriesPerWeek: true,
        deliveryAreas: { select: { lat: true, lng: true, radiusKm: true, deliveryDays: true } },
        deliveryZones: { where: { regionId: customer.regionId }, select: { deliveryDays: true } },
      },
    });
    if (!s) return null;
    if (s.deliverySchedule === "PER_WEEK") return deliveryFrequency("PER_WEEK", s.deliveriesPerWeek, null);
    let areaDays: string | null = null;
    if (s.deliveryAreas.length > 0) {
      const point = await customerPoint(customer);
      if (point) {
        areaDays =
          s.deliveryAreas
            .filter((a) => a.deliveryDays && distanceKm(a, point) <= a.radiusKm)
            .sort((a, b) => a.radiusKm - b.radiusKm)[0]?.deliveryDays ?? null;
      }
    } else {
      areaDays = s.deliveryZones[0]?.deliveryDays ?? null;
    }
    return deliveryFrequency(s.deliverySchedule, s.deliveriesPerWeek, areaDays);
  },
);
