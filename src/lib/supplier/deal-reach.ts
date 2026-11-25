import { db } from "@/lib/db";
import { servesCustomer } from "@/lib/geo";

/**
 * לכל מוצר: כמה לקוחות באזורי המשלוח של הספק שמים אותו בסל. רק מספר, בלי שמות,
 * כדי שהספק יבין כמה לקוחות המבצע יכול להגיע אליהם.
 */
export async function customersWithProducts(supplierId: string, productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const [supplier, items] = await Promise.all([
    db.supplier.findUnique({
      where: { id: supplierId },
      select: {
        deliveryAreas: { select: { lat: true, lng: true, radiusKm: true } },
        deliveryZones: { select: { regionId: true } },
      },
    }),
    db.basketItem.findMany({
      where: { productId: { in: productIds }, monthlyQuantity: { gt: 0 } },
      select: {
        productId: true,
        basket: { select: { customer: { select: { id: true, regionId: true, lat: true, lng: true } } } },
      },
    }),
  ]);
  if (!supplier) return new Map();
  const coverage = { areas: supplier.deliveryAreas, regionIds: supplier.deliveryZones.map((z) => z.regionId) };
  const seen = new Map<string, Set<string>>();
  for (const { productId, basket } of items) {
    const c = basket.customer;
    const point = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
    if (!servesCustomer(coverage, { regionId: c.regionId, point })) continue;
    const set = seen.get(productId) ?? new Set<string>();
    set.add(c.id);
    seen.set(productId, set);
  }
  return new Map([...seen].map(([id, set]) => [id, set.size]));
}
