import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { offeredPrice } from "@/lib/matches";
import { buildMonthlyReport, type ReportMonth, type WatchedProduct } from "./monthly-report";

const unitLabel = (u: string) => UNIT_LABEL[u as keyof typeof UNIT_LABEL] ?? u;

const PRICE_ALERTS = ["PRICE_INCREASE", "PRICE_DROP", "CHEAPER_SUPPLIER"] as const;

/** טוען את הנתונים של הלקוח לחודש ובונה את הדוח */
export async function loadMonthlyReport(customerId: string, month: ReportMonth) {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { regionId: true } });
  const baskets = await db.basket.findMany({
    where: { customerId, createdAt: { lt: month.end } },
    include: { items: { include: { product: { select: { name: true, unit: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  // מוצר שמופיע בכמה סלים נלקח מהסל העדכני ביותר
  const products = new Map<string, WatchedProduct>();
  for (const b of baskets) {
    for (const i of b.items) {
      if (products.has(i.productId)) continue;
      products.set(i.productId, {
        productId: i.productId,
        productName: i.product.name,
        unitLabel: unitLabel(i.product.unit),
        monthlyQuantity: i.monthlyQuantity,
        paidAgorot: i.currentUnitPriceAgorot,
        currentSupplierId: b.currentSupplierId,
      });
    }
  }
  const productIds = [...products.keys()];

  const [suppliers, lines, checks, alerts] = await Promise.all([
    db.supplier.findMany({
      where: { status: "APPROVED", deliveryZones: { some: { regionId: customer.regionId } } },
      select: {
        id: true,
        companyName: true,
        minOrderAgorot: true,
        deliveryZones: { where: { regionId: customer.regionId }, select: { feeAgorot: true, freeAboveAgorot: true } },
        priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1, select: { id: true } },
        offers: {
          where: { productId: { in: productIds }, available: true },
          select: {
            productId: true,
            prices: {
              where: { status: "LIVE", validFrom: { lt: month.end } },
              select: { tierId: true, unitPriceAgorot: true, kind: true, validFrom: true, validTo: true },
            },
          },
        },
      },
    }),
    db.matchRequestLine.findMany({
      where: {
        decision: "ACCEPTED",
        decidedAt: { gte: month.start },
        request: { customerId },
      },
      include: { request: { select: { supplier: { select: { companyName: true } } } } },
    }),
    db.optimizationRun.count({
      where: { basket: { customerId }, createdAt: { gte: month.start, lt: month.end } },
    }),
    db.notification.count({
      where: { customerId, kind: { in: [...PRICE_ALERTS] }, createdAt: { gte: month.start, lt: month.end } },
    }),
  ]);

  // רק המחירון הבסיסי של כל ספק: אותו מחיר שכל לקוח חדש מקבל
  const prices = suppliers.flatMap((s) =>
    s.offers.flatMap((o) =>
      o.prices
        .filter((p) => p.tierId === s.priceTiers[0]?.id)
        .map((p) => ({ supplierId: s.id, productId: o.productId, ...p })),
    ),
  );

  return buildMonthlyReport({
    month,
    products: [...products.values()],
    prices,
    supplierNames: Object.fromEntries(suppliers.map((s) => [s.id, s.companyName])),
    accepted: lines.flatMap((l) => {
      const after = offeredPrice(l);
      return after === null || !l.decidedAt
        ? []
        : [
            {
              productName: l.productName,
              unitLabel: unitLabel(l.unit),
              supplierName: l.request.supplier.companyName,
              monthlyQuantity: l.monthlyQuantity,
              beforeAgorot: l.currentPriceAgorot,
              afterAgorot: after,
              decidedAt: l.decidedAt,
            },
          ];
    }),
    checks,
    alerts,
    terms: Object.fromEntries(
      suppliers.map((s) => [
        s.id,
        {
          minOrderAgorot: s.minOrderAgorot,
          feeAgorot: s.deliveryZones[0]?.feeAgorot ?? 0,
          freeAboveAgorot: s.deliveryZones[0]?.freeAboveAgorot ?? null,
        },
      ]),
    ),
    deliveriesPerMonth: baskets[0]?.deliveriesPerMonth ?? 4,
  });
}
