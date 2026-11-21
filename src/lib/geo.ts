// חישובי מרחק ואזורי חלוקה על המפה. טהור, בלי גישה למסד, כדי שאפשר לבדוק בבדיקות יחידה.

export interface Point {
  lat: number;
  lng: number;
}

export interface Circle extends Point {
  radiusKm: number;
}

/** מרכז המפה כשאין עדיין אזור: מרכז הארץ, כך שכל ישראל נראית */
export const ISRAEL_CENTER: Point = { lat: 31.45, lng: 34.95 };

/** רדיוס ברירת המחדל לעיגול חדש, ותחום הרדיוס שאפשר לבחור */
export const DEFAULT_RADIUS_KM = 15;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 200;

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** מרחק בק״מ בין שתי נקודות (נוסחת האברסין) */
export function distanceKm(a: Point, b: Point) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** הנקודה בתוך לפחות אחד מהעיגולים */
export function insideAny(circles: Circle[], point: Point) {
  return circles.some((c) => distanceKm(c, point) <= c.radiusKm);
}

/** נקודה תקינה בתוך תחום ישראל והסביבה (מונע שמירה של נקודות שגויות) */
export function isNearIsrael(p: Point) {
  return p.lat >= 29 && p.lat <= 33.6 && p.lng >= 34 && p.lng <= 36;
}

/**
 * האם ספק מגיע ללקוח:
 * ספק שסימן אזורים על המפה מגיע רק לתוכם; ספק בלי אזורים על המפה מגיע לפי האזורים הכלליים (צפון, מרכז...).
 * ללקוח שעוד לא אותר על המפה בודקים לפי האזור הכללי בלבד.
 */
export function servesCustomer(
  supplier: { areas: Circle[]; regionIds: string[] },
  customer: { regionId: string; point: Point | null },
) {
  if (supplier.areas.length > 0 && customer.point) return insideAny(supplier.areas, customer.point);
  return supplier.regionIds.includes(customer.regionId);
}
