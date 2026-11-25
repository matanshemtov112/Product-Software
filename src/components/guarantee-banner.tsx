import Link from "next/link";
import { db } from "@/lib/db";
import { loadGuarantee, whatsappFor } from "@/lib/guarantee-view";
import { dealNumber } from "@/lib/guarantees";
import { GuaranteeBadge, WhatsAppButton } from "./guarantee";

/** בפנייה או בבקשת השוואה שהתקבלה: המחיר המובטח, קישור לעמוד העסקה וכפתור וואטסאפ */
export async function GuaranteeBanner({
  side,
  inquiryId,
  matchRequestId,
}: {
  side: "CUSTOMER" | "SUPPLIER";
  inquiryId?: string;
  matchRequestId?: string;
}) {
  const ref = await db.priceGuarantee.findFirst({
    where: inquiryId ? { inquiryId } : { matchRequestId },
    select: { id: true, customerId: true, supplierId: true },
  });
  if (!ref) return null;
  const g = await loadGuarantee(
    ref.id,
    side === "CUSTOMER" ? { customerId: ref.customerId } : { supplierId: ref.supplierId },
  );
  if (!g) return null;
  const whatsapp = whatsappFor(g, side);
  const base = side === "CUSTOMER" ? "/customer/agreements" : "/supplier/agreements";
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-good bg-good-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <GuaranteeBadge until={g.guaranteedUntil} />
        <p className="text-sm">
          עסקה {dealNumber(g.number)}.{" "}
          {side === "CUSTOMER"
            ? "המחירים שקיבלתם חלים על כל ההזמנות שלכם מהספק בתקופה הזו, והספק לא יכול לשנות אותם בלי האישור שלכם."
            : "המחירים בהצעה מחייבים אתכם מול הלקוח בכל ההזמנות בתקופה הזו."}{" "}
          <Link href={`${base}/${g.id}`} className="text-accent underline">
            לעמוד העסקה
          </Link>
        </p>
      </div>
      {whatsapp && <WhatsAppButton href={whatsapp} />}
    </section>
  );
}
