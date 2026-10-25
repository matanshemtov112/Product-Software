import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/form";
import { QuoteTable } from "@/components/quote-table";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INQUIRY_STATUS_LABEL, isQuoteSnapshot } from "@/lib/inquiries";
import { supplierForUser } from "@/lib/supplier/catalog";
import { CustomerReviewForm } from "./customer-review-form";
import { ReplyForm } from "./reply-form";

export default async function SupplierInquiry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewed?: string }>;
}) {
  const { id } = await params;
  const { reviewed } = await searchParams;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const inquiry = await db.negotiationRequest.findFirst({
    where: { id, supplierId: supplier.id },
    include: {
      customer: {
        include: { region: true, users: { select: { name: true, email: true, phone: true }, take: 1 } },
      },
    },
  });
  if (!inquiry) notFound();
  // פתיחת פנייה חדשה מסמנת אותה כנקראה
  if (inquiry.status === "SENT") {
    await db.negotiationRequest.update({ where: { id }, data: { status: "READ" } });
    inquiry.status = "READ";
  }
  const { customer } = inquiry;
  const myReview = await db.customerReview.findUnique({
    where: { supplierId_customerId: { supplierId: supplier.id, customerId: customer.id } },
  });
  const contact = customer.users[0];
  const gapPct = inquiry.gapAgorot ? (inquiry.gapAgorot / (inquiry.totalAgorot - inquiry.gapAgorot)) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/supplier/inquiries" className="text-sm text-muted hover:text-foreground">
          → כל הפניות
        </Link>
        <h1 className="text-2xl font-bold">פנייה מ{customer.businessName}</h1>
        <p className="text-sm text-muted">
          {customer.businessType} · {customer.city} · {customer.region.name} · {inquiry.createdAt.toLocaleDateString("he-IL")} ·{" "}
          {INQUIRY_STATUS_LABEL[inquiry.status]}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">ההצעה שלכם ללקוח</p>
          <p className="text-2xl font-bold">{shekels(inquiry.totalAgorot)}</p>
          <p className="text-xs text-muted">לחודש, כולל משלוחים, ללא מע״מ</p>
        </div>
        <div className="rounded-lg bg-accent-soft p-4">
          <p className="text-sm">הפער מול ספק מתחרה</p>
          <p className="text-2xl font-bold text-accent">{inquiry.gapAgorot ? shekels(inquiry.gapAgorot) : "אין"}</p>
          <p className="text-xs text-muted">
            {inquiry.gapAgorot ? `${gapPct.toFixed(1)}% בחודש. שם המתחרה לא נחשף.` : "אתם הזולים ביותר לסל הזה"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="text-muted">איש קשר</p>
          {contact ? (
            <>
              <p className="font-medium">{contact.name}</p>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="block text-accent" dir="ltr">
                  {contact.phone}
                </a>
              )}
              <a href={`mailto:${contact.email}`} className="block text-accent" dir="ltr">
                {contact.email}
              </a>
            </>
          ) : (
            <p>לא צוין</p>
          )}
        </div>
      </div>

      <Card title="ההודעה מהלקוח">
        <p className="whitespace-pre-line text-sm">{inquiry.message}</p>
      </Card>

      {isQuoteSnapshot(inquiry.quote) && (
        <Card title="ההצעה שהלקוח קיבל מהמערכת">
          <QuoteTable quote={inquiry.quote} />
        </Card>
      )}

      <Card title="התשובה שלכם">
        {inquiry.reply && (
          <div className="mb-4 rounded-md bg-background px-3 py-2 text-sm">
            <p className="text-xs text-muted">
              נשלחה {inquiry.repliedAt?.toLocaleDateString("he-IL")} · {INQUIRY_STATUS_LABEL[inquiry.status]}
            </p>
            <p className="whitespace-pre-line">{inquiry.reply}</p>
          </div>
        )}
        <ReplyForm inquiryId={inquiry.id} hasReply={Boolean(inquiry.reply)} />
        <p className="mt-3 text-xs text-muted">
          ההזמנה עצמה נעשית ישירות מולכם. אפשר גם לעדכן מחירים ברשימת המוצרים, כך שההשוואות הבאות יציגו אותם.
        </p>
      </Card>

      <Card title={`ביקורת על ${customer.businessName}`}>
        <p className="mb-3 text-sm text-muted">
          איך היה לעבוד עם הלקוח? הביקורת מופיעה ללקוח באזור שלו, עם שם החברה שלכם. אפשר לעדכן אותה בכל זמן.
        </p>
        {reviewed && myReview && (
          <p role="status" className="mb-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
            הביקורת נשמרה ומופיעה ללקוח.
          </p>
        )}
        <CustomerReviewForm
          inquiryId={inquiry.id}
          customerId={customer.id}
          existing={myReview && { overall: myReview.overall, payment: myReview.payment, communication: myReview.communication, text: myReview.text }}
        />
      </Card>
    </div>
  );
}
