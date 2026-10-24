import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { QuoteTable } from "@/components/quote-table";
import { requireRole } from "@/lib/auth/current";
import { basketQuotes, customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL, OPEN_INQUIRY } from "@/lib/inquiries";
import { InquiryForm } from "./inquiry-form";

export default async function InquiryPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const basket = customer.baskets[0];
  if (!basket) notFound();
  const row = (await basketQuotes(basket.id)).rows.find((r) => r.supplierId === supplierId);
  if (!row) notFound();
  const open = await db.negotiationRequest.findFirst({
    where: { customerId: customer.id, supplierId, status: { in: OPEN_INQUIRY } },
  });

  const gap = row.quote.gapAgorot;
  const defaultMessage = gap
    ? `שלום, אנחנו ${customer.businessName} ומעוניינים לעבוד איתכם. קיבלנו דרך המערכת את ההצעה שלכם לסל החודשי שלנו, ` +
      `אבל יש פער של ${shekels(gap)} בחודש מול ספק מתחרה. נשמח לשמוע אם תוכלו להתאים את המחיר.`
    : `שלום, אנחנו ${customer.businessName} ומעוניינים לעבוד איתכם על הסל החודשי שלנו. נשמח שתיצרו קשר.`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer" className="text-sm text-muted hover:text-foreground">
          → חזרה להשוואה
        </Link>
        <h1 className="text-2xl font-bold">פנייה ל{row.supplierName}</h1>
        <p className="text-sm text-muted">
          הספק יקבל את ההצעה הזאת, את ההודעה שלכם ואת פרטי הקשר שלכם. שם הספק המתחרה לא נחשף, רק גובה הפער.
        </p>
      </div>

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

      <Card title="ההודעה לספק">
        {open ? (
          <p className="text-sm">
            כבר שלחתם פנייה לספק הזה ב-{open.createdAt.toLocaleDateString("he-IL")} (סטטוס:{" "}
            {INQUIRY_STATUS_LABEL[open.status]}). אפשר לשלוח פנייה חדשה אחרי שהספק יענה.
          </p>
        ) : (
          <InquiryForm supplierId={supplierId} defaultMessage={defaultMessage} />
        )}
      </Card>
    </div>
  );
}
