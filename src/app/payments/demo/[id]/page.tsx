import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { HOLD_DAYS, paymentsProvider } from "@/lib/payments/holds";
import { DemoCheckoutForm } from "./checkout-form";

export const metadata = { title: "אישור מסגרת אשראי", robots: { index: false } };

/** דף תשלום לדוגמה, במקום דף התשלום של חברת הסליקה, עד שתחובר חברה אמיתית */
export default async function DemoCheckout({ params }: { params: Promise<{ id: string }> }) {
  if (paymentsProvider() !== "demo") notFound();
  const { id } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const hold = await db.cardHold.findFirst({
    where: { id, customerId: customer.id, provider: "demo" },
    include: { inquiry: { include: { supplier: { select: { companyName: true } } } } },
  });
  if (!hold) notFound();
  if (hold.status !== "PENDING") redirect(`/customer/inquiries/${hold.inquiryId}`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-6">
      <p role="note" className="rounded-md border border-[#e0b400] bg-[#fff8db] px-3 py-2 text-sm text-black">
        מצב הדגמה: זה לא דף תשלום אמיתי ולא מתבצע חיוב. אחרי שתחובר חברת סליקה, הכרטיס יוזן בדף המאובטח שלה.
      </p>
      <h1 className="text-2xl font-bold">אישור ההזמנה הראשונה</h1>
      <Card>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">ספק</dt>
            <dd>{hold.inquiry.supplier.companyName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">מסגרת (ההזמנה הראשונה, כולל מע״מ)</dt>
            <dd className="font-semibold">{shekels(hold.amountAgorot)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm">
          זו תפיסת מסגרת ולא חיוב: הכסף לא יורד מהחשבון. המסגרת משתחררת כשהספק מאשר שההזמנה הראשונה סופקה, ולכל המאוחר
          אחרי {HOLD_DAYS} ימים. את ההזמנה עצמה משלמים לספק כרגיל.
        </p>
      </Card>
      <Card>
        <DemoCheckoutForm holdId={hold.id} amount={shekels(hold.amountAgorot)} />
        <p className="mt-2 text-xs text-muted">בהדגמה: כרטיס שמסתיים ב-0002 נדחה. למשל 4111 1111 1111 1111 מאושר.</p>
      </Card>
      <Link href={`/customer/inquiries/${hold.inquiryId}`} className="text-sm text-muted hover:text-foreground">
        → חזרה לפנייה בלי לאשר
      </Link>
    </div>
  );
}
