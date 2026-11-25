import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { isDealSnapshot } from "@/lib/customer/deals";
import { isQuoteSnapshot } from "@/lib/inquiries";
import { offeredPrice } from "@/lib/matches";

/**
 * מחיר מובטח: כשלקוח מקבל הצעה של ספק, המחירים בה מחייבים את הספק מול הלקוח הזה 30 יום, בכל ההזמנות.
 * הספק לא יכול לשנות אותם. שינוי מחיר נעשה רק כבקשה שהלקוח מאשר, וכל גרסה נשמרת.
 * חשבונית מהספק בתקופה הזו נבדקת מול המחירים המובטחים.
 */

export const GUARANTEE_DAYS = 30;
const DAY = 86_400_000;

export const guaranteeEnd = (acceptedAt: Date) => new Date(acceptedAt.getTime() + GUARANTEE_DAYS * DAY);

export const isActive = (g: { guaranteedUntil: Date }, now = new Date()) => g.guaranteedUntil > now;

/** פער שלא נחשב חריגה (עיגול אגורות בחשבונית) */
export const BREACH_TOLERANCE_AGOROT = 1;

type LineInput = Omit<Prisma.GuaranteeLineCreateManyGuaranteeInput, "id">;

/** מספר העסקה לתצוגה, למשל "#1024" */
export const dealNumber = (n: number) => `#${1000 + n}`;

/** יצירת המחיר המובטח לפנייה שהתקבלה. פעם אחת לכל פנייה (קריאה נוספת לא משנה דבר) */
export async function guaranteeInquiry(inquiryId: string) {
  const inquiry = await db.negotiationRequest.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      customerId: true,
      supplierId: true,
      outcome: true,
      outcomeAt: true,
      quote: true,
      deal: true,
      guarantee: { select: { id: true } },
    },
  });
  if (!inquiry || inquiry.outcome !== "ACCEPTED" || inquiry.guarantee) return inquiry?.guarantee ?? null;
  const lines: LineInput[] = [];
  if (isQuoteSnapshot(inquiry.quote)) {
    const names = inquiry.quote.lines.map((l) => l.productName);
    const products = new Map(
      (await db.product.findMany({ where: { name: { in: names } }, select: { id: true, name: true } })).map((p) => [
        p.name,
        p.id,
      ]),
    );
    for (const l of inquiry.quote.lines) {
      const productId = products.get(l.productName);
      if (!productId || lines.some((x) => x.productId === productId)) continue;
      lines.push({
        productId,
        productName: l.productName,
        unitLabel: UNIT_LABEL[l.unit],
        packLabel: l.pack ?? null,
        monthlyQuantity: l.quantity,
        unitPriceAgorot: l.unitPriceAgorot,
      });
    }
  }
  const acceptedAt = inquiry.outcomeAt ?? new Date();
  return create(
    {
      customerId: inquiry.customerId,
      supplierId: inquiry.supplierId,
      inquiryId: inquiry.id,
      acceptedAt,
      guaranteedUntil: guaranteeEnd(acceptedAt),
      note: isDealSnapshot(inquiry.deal) ? `${inquiry.deal.productName}: ${inquiry.deal.dealText}` : null,
    },
    lines,
  );
}

/** יצירת המחיר המובטח לבקשת השוואה שהתקבלה: רק השורות שהלקוח אישר */
export async function guaranteeMatch(matchRequestId: string) {
  const request = await db.matchRequest.findUnique({
    where: { id: matchRequestId },
    include: { lines: true, guarantee: { select: { id: true } } },
  });
  if (!request || request.outcome !== "ACCEPTED" || request.guarantee) return request?.guarantee ?? null;
  const lines: LineInput[] = [];
  for (const l of request.lines) {
    const price = offeredPrice(l);
    if (l.decision !== "ACCEPTED" || price === null) continue;
    lines.push({
      productId: l.productId,
      productName: l.productName,
      unitLabel: l.unit,
      packLabel: null,
      monthlyQuantity: l.monthlyQuantity,
      unitPriceAgorot: price,
    });
  }
  const acceptedAt = request.outcomeAt ?? new Date();
  return create(
    {
      customerId: request.customerId,
      supplierId: request.supplierId,
      matchRequestId: request.id,
      acceptedAt,
      guaranteedUntil: guaranteeEnd(acceptedAt),
    },
    lines,
  );
}

async function create(data: Prisma.PriceGuaranteeUncheckedCreateInput, lines: LineInput[]) {
  try {
    return await db.priceGuarantee.create({
      data: { ...data, lines: { createMany: { data: lines } } },
      select: { id: true },
    });
  } catch (e) {
    // נוצר במקביל (שתי לחיצות): מחזירים את הקיים
    if ((e as { code?: string }).code === "P2002") {
      return db.priceGuarantee.findFirst({
        where: data.inquiryId ? { inquiryId: data.inquiryId } : { matchRequestId: data.matchRequestId },
        select: { id: true },
      });
    }
    throw e;
  }
}

/** המחירים המובטחים בתוקף של ספק מול לקוח, לפי מוצר (המחיר הנמוך כשיש כמה עסקאות) */
export async function guaranteedPrices(
  customerId: string,
  supplierId: string,
  at = new Date(),
  /** עד מתי העסקה יכולה להיות מאושרת (לחשבונית: סוף יום החשבונית) */
  acceptedBy = at,
) {
  const guarantees = await db.priceGuarantee.findMany({
    where: { customerId, supplierId, acceptedAt: { lte: acceptedBy }, guaranteedUntil: { gt: at } },
    include: { lines: true },
    orderBy: { acceptedAt: "desc" },
  });
  const prices = new Map<
    string,
    { guaranteeId: string; lineId: string; productName: string; unitPriceAgorot: number }
  >();
  for (const g of guarantees) {
    for (const l of g.lines) {
      const current = prices.get(l.productId);
      if (!current || l.unitPriceAgorot < current.unitPriceAgorot) {
        prices.set(l.productId, {
          guaranteeId: g.id,
          lineId: l.id,
          productName: l.productName,
          unitPriceAgorot: l.unitPriceAgorot,
        });
      }
    }
  }
  return prices;
}

/** כמה לקוחות קיבלו מחיר מובטח על מוצר של הספק, ועד מתי (לאזהרה בעריכת מחיר) */
export async function activeGuaranteesFor(supplierId: string, productId: string, now = new Date()) {
  const rows = await db.priceGuarantee.findMany({
    where: { supplierId, guaranteedUntil: { gt: now }, lines: { some: { productId } } },
    select: { customerId: true, guaranteedUntil: true },
  });
  const customers = new Set(rows.map((r) => r.customerId));
  const until = rows.reduce<Date | null>((max, r) => (!max || r.guaranteedUntil > max ? r.guaranteedUntil : max), null);
  return { customers: customers.size, until };
}

export interface InvoiceCheckLine {
  productId: string;
  unitPriceAgorot: number | null;
}

export interface Breach {
  guaranteeId: string;
  lineId: string;
  productName: string;
  guaranteedAgorot: number;
  chargedAgorot: number;
}

/** השוואת שורות חשבונית למחירים המובטחים: רק שורות שבהן הספק חייב יותר */
export function findBreaches(
  lines: InvoiceCheckLine[],
  prices: Awaited<ReturnType<typeof guaranteedPrices>>,
): Breach[] {
  const out: Breach[] = [];
  for (const l of lines) {
    const g = prices.get(l.productId);
    if (!g || l.unitPriceAgorot === null) continue;
    if (l.unitPriceAgorot > g.unitPriceAgorot + BREACH_TOLERANCE_AGOROT) {
      out.push({
        guaranteeId: g.guaranteeId,
        lineId: g.lineId,
        productName: g.productName,
        guaranteedAgorot: g.unitPriceAgorot,
        chargedAgorot: l.unitPriceAgorot,
      });
    }
  }
  return out;
}

const normName = (s: string) => s.replace(/בע["״']?מ|ספק דמו:|[\s"'״׳.,\-()]/g, "").toLowerCase();

/**
 * הספק של חשבונית בין הספקים שיש ללקוח מהם מחיר מובטח בתאריך החשבונית: לפי ספק רשום שזוהה,
 * או לפי שם דומה (למשל "בשרים הגליל בע״מ" מול "בשרים הגליל").
 */
async function guaranteeSupplierFor(
  customerId: string,
  supplierId: string | null,
  typedName: string | null,
  at: Date,
  acceptedBy: Date,
) {
  if (supplierId) return supplierId;
  if (!typedName) return null;
  const typed = normName(typedName);
  if (typed.length < 3) return null;
  const candidates = await db.priceGuarantee.findMany({
    where: { customerId, acceptedAt: { lte: acceptedBy }, guaranteedUntil: { gt: at } },
    select: { supplierId: true, supplier: { select: { companyName: true } } },
    distinct: ["supplierId"],
  });
  const hit = candidates.filter((c) => {
    const name = normName(c.supplier.companyName);
    return name.length >= 3 && (typed.includes(name) || name.includes(typed));
  });
  return hit.length === 1 ? hit[0].supplierId : null;
}

/**
 * בדיקת חשבונית מול המחירים המובטחים: שורה שבה הספק חייב יותר נשמרת כחריגה, הלקוח מקבל התראה,
 * וצוות הפלטפורמה רואה אותה בעמוד הדיווחים. בלי עונש אוטומטי לספק.
 */
export async function checkInvoiceGuarantees(opts: {
  customerId: string;
  invoiceId: string;
  invoiceDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  lines: InvoiceCheckLine[];
}) {
  if (!opts.invoiceDate) return [];
  // לחשבונית יש רק תאריך: עסקה שאושרה עד סוף היום הזה, והבטחה שעוד הייתה בתוקף בתחילתו (שעון ישראל)
  const dayStart = new Date(`${opts.invoiceDate}T00:00:00+02:00`);
  const dayEnd = new Date(`${opts.invoiceDate}T23:59:59+02:00`);
  if (Number.isNaN(dayStart.getTime())) return [];
  const supplierId = await guaranteeSupplierFor(opts.customerId, opts.supplierId, opts.supplierName, dayStart, dayEnd);
  if (!supplierId) return [];
  const breaches = findBreaches(opts.lines, await guaranteedPrices(opts.customerId, supplierId, dayStart, dayEnd));
  if (breaches.length === 0) return [];
  const created = await db.guaranteeBreach.createMany({
    data: breaches.map((b) => ({
      guaranteeId: b.guaranteeId,
      lineId: b.lineId,
      invoiceId: opts.invoiceId,
      invoiceDate: opts.invoiceDate,
      guaranteedAgorot: b.guaranteedAgorot,
      chargedAgorot: b.chargedAgorot,
    })),
    skipDuplicates: true,
  });
  if (created.count === 0) return breaches;
  const { notify } = await import("@/lib/notifications");
  const { audit } = await import("@/lib/audit");
  const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { companyName: true } });
  const names = breaches.map((b) => b.productName);
  await notify([
    {
      customerId: opts.customerId,
      aboutSupplierId: supplierId,
      kind: "GUARANTEE_BREACH",
      title: `${supplier?.companyName ?? "הספק"} חייב יותר מהמחיר המובטח`,
      body: `בחשבונית: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` ועוד ${names.length - 3}` : ""}. פרטים בעמוד העסקה.`,
      href: `/customer/agreements/${breaches[0].guaranteeId}`,
      dedupeKey: `guarantee-breach:${opts.invoiceId}`,
    },
  ]);
  await audit({
    action: "guarantee.breach",
    targetType: "guarantee",
    targetId: breaches[0].guaranteeId,
    details: { invoiceId: opts.invoiceId, supplier: supplier?.companyName, products: names },
  });
  return breaches;
}
