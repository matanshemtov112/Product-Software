import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { QuoteTable } from "@/components/quote-table";
import { requireRole } from "@/lib/auth/current";
import { customerProfile } from "@/lib/customer/profile";
import { analyzeBasket, customerForUser, getBasket } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL, OPEN_INQUIRY, profileRows } from "@/lib/inquiries";
import { supplierLogoUrl } from "@/lib/supplier/logo";
import { InquiryForm } from "./inquiry-form";

export default async function InquiryPage({ params }: { params: Promise<{ id: string; supplierId: string }> }) {
  const { id, supplierId } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const basket = await getBasket(customer.id, id);
  if (!basket) notFound();
  const row = (await analyzeBasket(basket.id)).rows.find((r) => r.supplierId === supplierId);
  if (!row) notFound();
  const profile = await customerProfile(customer.id, basket);
  const about = await db.supplier.findUnique({
    where: { id: supplierId },
    select: {
      description: true,
      openingHours: true,
      deliveryTerms: true,
      paymentTermsDays: true,
      minOrderAgorot: true,
      logo: { select: { updatedAt: true } },
    },
  });
  const logoUrl = about ? supplierLogoUrl(supplierId, about.logo) : null;
  const paidLines = row.snapshot.lines.filter((l) => l.customerPaidAgorot != null);
  const cheaperToday = paidLines.filter((l) => l.customerPaidAgorot! < l.unitPriceAgorot);
  const cheaperHere = paidLines.filter((l) => l.customerPaidAgorot! > l.unitPriceAgorot);
  const open = await db.negotiationRequest.findFirst({
    where: {
      customerId: customer.id,
      supplierId,
      status: { in: OPEN_INQUIRY },
    },
  });

  const gap = row.quote.gapAgorot;
  const defaultMessage =
    (gap
      ? `שלום, אנחנו ${customer.businessName} ומעוניינים לעבוד איתכם. קיבלנו דרך המערכת את ההצעה שלכם לסל החודשי שלנו, ` +
        `אבל יש פער של ${shekels(gap)} בחודש מול ספק מתחרה. נשמח לשמוע אם תוכלו להתאים את המחיר.`
      : `שלום, אנחנו ${customer.businessName} ומעוניינים לעבוד איתכם על הסל החודשי שלנו. נשמח שתיצרו קשר.`) +
    (cheaperHere.length
      ? ` ראינו אצלכם במערכת מחיר טוב יותר ממה שאנחנו משלמים היום על ${cheaperHere.map((l) => l.productName).join(", ")}, ונשמח שתאשרו לנו אותו.`
      : "") +
    (cheaperToday.length
      ? ` היום אנחנו משלמים פחות על ${cheaperToday.map((l) => l.productName).join(", ")}; המחירים מופיעים בהצעה.`
      : "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/customer/baskets/${basket.id}`} className="text-sm text-muted hover:text-foreground">
          → חזרה להשוואה
        </Link>
        <h1 className="text-2xl font-bold">פנייה ל{row.supplierName}</h1>
        <p className="text-sm text-muted">
          הספק יקבל את ההצעה, ההודעה שלכם וכל הפרטים שמסרתם בהרשמה ובסל
          {paidLines.length ? ", כולל המחירים שאתם משלמים היום" : ""}. שם הספק המתחרה ושם הספק הנוכחי שלכם לא נחשפים.
        </p>
      </div>

      {about && (
        <Card title="על הספק">
          <div className="flex items-start gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`הלוגו של ${row.supplierName}`}
                className="size-14 shrink-0 rounded-lg border border-border bg-white object-contain"
              />
            )}
            <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {about.description && <dd className="text-foreground sm:col-span-2">{about.description}</dd>}
              {(
                [
                  ["שעות פעילות", about.openingHours],
                  ["תנאי אספקה", about.deliveryTerms],
                  ["מינימום הזמנה", about.minOrderAgorot ? shekels(about.minOrderAgorot) : "אין"],
                  ["תנאי תשלום", `שוטף + ${about.paymentTermsDays}`],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">ההצעה של הספק</p>
          <p className="text-2xl font-bold">{shekels(row.quote.share.totalAgorot)}</p>
          <p className="text-xs text-muted">לחודש, כולל משלוחים</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">החלופה הזולה לאותם מוצרים</p>
          <p className="text-2xl font-bold">{shekels(row.quote.bestAlternativeAgorot)}</p>
          <p className="text-xs text-muted">מספק אחר או משילוב ספקים</p>
        </div>
        <div className="rounded-lg bg-accent-soft p-4">
          <p className="text-sm">פער מחיר</p>
          <p className="text-2xl font-bold text-accent">{gap ? shekels(gap) : "אין"}</p>
          <p className="text-xs text-muted">
            {gap ? `${((gap / row.quote.bestAlternativeAgorot) * 100).toFixed(1)}% יותר בחודש` : "הספק כבר הזול ביותר"}
          </p>
        </div>
      </div>

      <Card title="ההצעה שקיבלתם">
        <QuoteTable quote={row.snapshot} />
      </Card>

      <Card title="הפרטים שיישלחו לספק">
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {profileRows(profile).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          הפרטים נלקחים מההרשמה ומהסל. לעדכון פרטי העסק:{" "}
          <Link href="/customer/profile" className="text-accent">
            פרטי העסק
          </Link>
          ; לעדכון ההיקף והאספקות:{" "}
          <Link href={`/customer/baskets/${basket.id}/edit`} className="text-accent">
            עריכת הסל
          </Link>
          .
        </p>
      </Card>

      <Card title="ההודעה לספק">
        {open ? (
          <p className="text-sm">
            כבר שלחתם פנייה לספק הזה ב-
            {open.createdAt.toLocaleDateString("he-IL")} (סטטוס: {INQUIRY_STATUS_LABEL[open.status]}). אפשר לשלוח פנייה
            חדשה אחרי שהספק יענה.
          </p>
        ) : (
          <InquiryForm basketId={basket.id} supplierId={supplierId} defaultMessage={defaultMessage} />
        )}
      </Card>
    </div>
  );
}
