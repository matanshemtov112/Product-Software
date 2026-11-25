import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { isCustomerProfile } from "@/lib/inquiries";
import { dealMessage, internationalPhone, supplierWhatsapp, whatsappUrl } from "@/lib/whatsapp";
import { dealNumber, isActive } from "./guarantees";

/** תאריך בשעון ישראל, למשל 25.12.2026 */
export const dayText = (d: Date) =>
  d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric" });

/** "2026-11-25" → "25.11.2026" */
export const isoDayText = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso;
};

const include = {
  supplier: {
    select: { id: true, companyName: true, contactPhone: true, whatsappEnabled: true, whatsappPhone: true },
  },
  customer: {
    select: {
      id: true,
      businessName: true,
      city: true,
      // איש הקשר העדכני, כשבפנייה לא נשמר טלפון
      users: {
        select: { phone: true },
        orderBy: [{ isManager: "desc" as const }, { createdAt: "asc" as const }],
        take: 1,
      },
    },
  },
  inquiry: { select: { id: true, customerProfile: true } },
  matchRequest: { select: { id: true, customerProfile: true } },
  lines: { orderBy: { productName: "asc" as const } },
  changes: {
    orderBy: { createdAt: "desc" as const },
    include: { line: { select: { productName: true, unitLabel: true } } },
  },
  breaches: {
    orderBy: { createdAt: "desc" as const },
    include: { line: { select: { productName: true, unitLabel: true } } },
  },
};

/** עסקה אחת, רק אם היא של הלקוח או של הספק המחובר */
export function loadGuarantee(id: string, scope: { customerId: string } | { supplierId: string }) {
  return db.priceGuarantee.findFirst({ where: { id, ...scope }, include });
}

export type GuaranteeView = NonNullable<Awaited<ReturnType<typeof loadGuarantee>>>;

/** קישור וואטסאפ עם הודעה מוכנה, לצד שצופה בעסקה; null כשהספק כיבה וואטסאפ או שאין מספר */
export function whatsappFor(g: GuaranteeView, side: "CUSTOMER" | "SUPPLIER"): string | null {
  if (!isActive(g)) return null;
  const supplierPhone = supplierWhatsapp(g.supplier);
  if (!supplierPhone) return null;
  const until = dayText(g.guaranteedUntil);
  const number = dealNumber(g.number);
  if (side === "CUSTOMER") {
    return whatsappUrl(
      supplierPhone,
      dealMessage({
        side,
        number,
        otherName: g.supplier.companyName,
        myName: g.customer.businessName,
        until,
        url: appUrl(`/supplier/agreements/${g.id}`),
      }),
    );
  }
  const profile = g.inquiry?.customerProfile ?? g.matchRequest?.customerProfile;
  const customerPhone =
    (isCustomerProfile(profile) ? internationalPhone(profile.phone) : null) ??
    internationalPhone(g.customer.users[0]?.phone);
  if (!customerPhone) return null;
  return whatsappUrl(
    customerPhone,
    dealMessage({
      side,
      number,
      otherName: g.customer.businessName,
      myName: g.supplier.companyName,
      until,
      url: appUrl(`/customer/agreements/${g.id}`),
    }),
  );
}

/** רשימת העסקאות: בתוקף קודם, ואז אלה שההבטחה שלהן נגמרה */
export function listGuarantees(scope: { customerId: string } | { supplierId: string }) {
  return db.priceGuarantee.findMany({
    where: scope,
    include: {
      supplier: { select: { companyName: true } },
      customer: { select: { businessName: true, city: true } },
      _count: { select: { lines: true, changes: { where: { status: "PENDING" } }, breaches: true } },
    },
    orderBy: [{ guaranteedUntil: "desc" }],
    take: 200,
  });
}
