import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { SaleMark } from "@/components/price-badge";
import { requireRole } from "@/lib/auth/current";
import { customerDeals } from "@/lib/customer/deals";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { OPEN_INQUIRY } from "@/lib/inquiries";
import { lastValidDay, shortDate } from "@/lib/price-status";
import { DealInquiryForm } from "./deal-form";

export default async function DealPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const deal = (await customerDeals(customer.id)).find((d) => d.offerId === offerId);
  if (!deal) notFound();
  const [supplier, basket, open] = await Promise.all([
    db.supplier.findUniqueOrThrow({
      where: { id: deal.supplierId },
      select: {
        minOrderAgorot: true,
        deliveryZones: { where: { regionId: customer.regionId }, select: { feeAgorot: true, freeAboveAgorot: true } },
      },
    }),
    db.basket.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        deliveriesPerMonth: true,
        items: { where: { productId: deal.productId }, select: { monthlyQuantity: true } },
      },
    }),
    db.negotiationRequest.findFirst({
      where: { customerId: customer.id, supplierId: deal.supplierId, status: { in: OPEN_INQUIRY } },
    }),
  ]);
  const zone = supplier.deliveryZones[0];
  const deliveries = basket?.deliveriesPerMonth ?? 4;
  const monthly = basket?.items[0]?.monthlyQuantity;
  const suggested = deal.quantityDeal?.minPerOrder ?? (monthly ? Math.round((monthly / deliveries) * 100) / 100 : "");
  const dealText = [
    deal.promotion &&
      `מבצע: ${shekels(deal.promotion.priceAgorot, 2)} ל${deal.unitLabel}${deal.promotion.validTo ? ` עד ${shortDate(lastValidDay(deal.promotion.validTo))}` : ""}`,
    deal.quantityDeal?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/deals" className="text-sm text-muted hover:text-foreground">
          → חזרה למבצעים
        </Link>
        <h1 className="text-2xl font-bold">
          <SaleMark />
          {deal.productName} · {deal.supplierName}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="המבצע">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">המבצע</dt>
            <dd>{dealText}</dd>
            <dt className="text-muted">מחיר רגיל</dt>
            <dd>{deal.regularAgorot !== null ? `${shekels(deal.regularAgorot, 2)} ל${deal.unitLabel}` : "—"}</dd>
            <dt className="text-muted">איך מגיע</dt>
            <dd>{deal.pack}</dd>
            <dt className="text-muted">מינימום הזמנה</dt>
            <dd>{supplier.minOrderAgorot ? shekels(supplier.minOrderAgorot) : "אין"}</dd>
            <dt className="text-muted">משלוח לאזור שלכם</dt>
            <dd>{zone ? "חינם" : "—"}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">המחירים ללא מע״מ. ההזמנה עצמה נעשית ישירות מול הספק.</p>
        </Card>
        <Card title="פנייה לספק">
          {open ? (
            <p className="text-sm">
              כבר יש לכם פנייה פתוחה לספק הזה.{" "}
              <Link href="/customer/inquiries" className="text-accent">
                לפניות שלי
              </Link>
            </p>
          ) : (
            <DealInquiryForm
              offerId={deal.offerId}
              unitLabel={deal.unitLabel}
              suggestedQuantity={String(suggested)}
              deliveries={deliveries}
              defaultMessage={`שלום, אנחנו ${customer.businessName} וראינו במערכת את המבצע שלכם על ${deal.productName}. נשמח לשמוע פרטים ולהתחיל לעבוד איתכם.`}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
