import Link from "next/link";
import { invoiceReadingEnabled } from "@/lib/invoices/read";
import { InvoiceUpload } from "./invoice-upload";

export default function NewInvoicePage() {
  const enabled =
    invoiceReadingEnabled() || (process.env.NODE_ENV !== "production" && Boolean(process.env.INVOICE_FAKE_RESULT));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/baskets/new" className="text-sm text-muted hover:text-foreground">
          → דרך אחרת להתחיל
        </Link>
        <h1 className="text-2xl font-bold">העלאת חשבונית</h1>
        <p className="text-sm text-muted">
          נקרא מהחשבונית את המוצרים, הכמויות והמחירים שאתם משלמים היום, ונשווה אותם למחירים של ספקים אחרים. לפני ההשוואה
          תוכלו לבדוק ולתקן כל שורה. הקובץ עצמו לא נשמר אצלנו.
        </p>
      </div>
      {enabled ? (
        <InvoiceUpload />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted">
          קריאת חשבוניות עוד לא הופעלה בשרת הזה. כדי להפעיל אותה צריך להגדיר מפתח API של Claude בהגדרות השרת. בינתיים
          אפשר{" "}
          <Link href="/customer/baskets/new?mode=manual" className="text-accent">
            לבנות את הרשימה בעצמכם
          </Link>
          .
        </p>
      )}
    </div>
  );
}
