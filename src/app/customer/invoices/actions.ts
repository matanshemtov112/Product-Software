"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { requirePermission } from "@/lib/auth/permission-check";
import { catalogForBasket } from "@/lib/customer/catalog";
import { customerForUser } from "@/lib/customer/quotes";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { db } from "@/lib/db";
import { after } from "next/server";
import { notifyInvoiceSavings } from "@/lib/notify/invoice-savings";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { basketItemsFromInvoice, monthlyFromUsage, type ConfirmedLine } from "@/lib/invoices/basket";
import { invoiceAge, normalizeInvoiceDate } from "@/lib/invoices/age";
import { checkInvoiceFiles } from "@/lib/invoices/files";
import { purgeOldInvoices } from "@/lib/invoices/retention";
import { claudeInvoiceReader, parseInvoice, type ReadResult } from "@/lib/invoices/read";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface InvoiceFormState {
  error?: string;
}

async function currentCustomer() {
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  return customerForUser(session.userId);
}

/**
 * לבדיקות בלבד: תשובה קבועה במקום קריאה ל-Claude, כדי לבדוק את המסכים בלי מפתח API.
 * לא פעיל בייצור.
 */
function fakeReading(catalogNames: string[]): ReadResult | null {
  const fake = process.env.INVOICE_FAKE_RESULT;
  if (!fake || process.env.NODE_ENV === "production") return null;
  return parseInvoice(fake, catalogNames);
}

/** קריאת החשבונית ושמירת השורות, ואז מעבר למסך הבדיקה */
export async function readInvoice(_: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const customer = await currentCustomer();
  if (!rateLimit.hit(`ai:${customer.id}`, LIMITS.aiRequests)) {
    return { error: "הגעתם למספר הקריאות המרבי לשעה. נסו שוב בעוד קצת." };
  }
  await purgeOldInvoices();
  const checked = await checkInvoiceFiles(form.getAll("pages"));
  if (!checked.ok) return { error: checked.error };

  const catalog = (await catalogForBasket()).map((c) => ({
    name: c.name,
    unit: c.unit as "KG" | "LITER" | "UNIT",
    category: c.parentCategory ? `${c.parentCategory} / ${c.category}` : c.category,
    aliases: c.aliases ?? [],
  }));
  // המותגים שספקים כתבו במערכת, כדי שהמותג מהחשבונית ייכתב באותה צורה וההשוואה לפי מותג תעבוד
  const knownBrands = (
    await db.supplierOffer.findMany({
      where: { brand: { not: null }, archivedAt: null },
      distinct: ["brand"],
      select: { brand: true },
      take: 300,
    })
  ).flatMap((o) => (o.brand ? [o.brand] : []));
  const result =
    fakeReading(catalog.map((c) => c.name)) ?? (await claudeInvoiceReader(checked.files, catalog, knownBrands));

  if (result.kind === "not_configured") return { error: "קריאת חשבוניות עוד לא הופעלה בשרת הזה." };
  if (result.kind === "refused") return { error: "לא הצלחנו לקרוא את הקובץ. נסו צילום ברור יותר של החשבונית." };
  if (result.kind === "error") return { error: result.message };
  if (result.lines.length === 0)
    return { error: "לא מצאנו שורות מוצרים בקובץ. ודאו שכל החשבונית בתמונה, באור טוב וללא צל." };

  const invoice = await db.invoice.create({
    data: {
      customerId: customer.id,
      supplierName: result.supplierName,
      invoiceDate: result.invoiceDate,
      fileCount: checked.files.length,
      lines: JSON.parse(JSON.stringify(result.lines)),
    },
  });
  redirect(`/customer/invoices/${invoice.id}`);
}

const confirmSchema = z.object({
  invoiceId: z.string().min(1),
  name: z.string().trim().min(2, "נא לתת שם לסל").max(60),
  supplierName: z.string().trim().max(80).optional(),
  invoicesPerMonth: z.coerce.number().min(0.25, "כמה פעמים בחודש מגיעה חשבונית כזו?").max(31),
  // invoice = הכמויות מהחשבונית; own = רק המוצרים, והלקוח ממלא צריכה לשבוע או לחודש
  quantityMode: z.enum(["invoice", "own"]).default("invoice"),
  usagePeriod: z.enum(["week", "month"]).default("month"),
  invoiceDate: z.string().trim().max(20).optional(),
  // חשבונית בת 3-12 חודשים: האם המחירים בה עדיין נכונים
  oldPrices: z.enum(["keep", "drop"]).optional(),
});

/** יצירת סל מהשורות שהלקוח אישר: הספק הנוכחי והמחירים של היום, ומשם ישר להשוואה */
export async function basketFromInvoice(_: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const customer = await currentCustomer();
  const parsed = confirmSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const data = parsed.data;
  const invoice = await db.invoice.findFirst({ where: { id: data.invoiceId, customerId: customer.id } });
  if (!invoice) return { error: "החשבונית לא נמצאה" };

  const rows = form.getAll("line").map(String);
  const productIds = [...new Set(rows.map((i) => String(form.get(`product_${i}`) ?? "")).filter(Boolean))];
  const products = new Map(
    (await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })).map((p) => [
      p.id,
      p,
    ]),
  );
  // תאריך החשבונית: חשבונית ישנה מדי לא משמשת כמחיר הנוכחי של הלקוח
  const invoiceDate = normalizeInvoiceDate(data.invoiceDate);
  const age = invoiceAge(invoiceDate);
  if (age.kind === "unknown") return { error: "נא למלא את תאריך החשבונית" };
  if (age.kind === "future") return { error: "תאריך החשבונית בעתיד. בדקו שהתאריך נכון" };
  if (age.kind === "old" && !data.oldPrices) {
    return { error: "החשבונית מלפני כמה חודשים. נא לבחור אם המחירים בה עדיין נכונים" };
  }
  const usePrices = age.kind === "fresh" || (age.kind === "old" && data.oldPrices === "keep");

  const own = data.quantityMode === "own";
  const periodWord = data.usagePeriod === "week" ? "השבועית" : "החודשית";
  const lines: ConfirmedLine[] = [];
  for (const i of rows) {
    const product = products.get(String(form.get(`product_${i}`) ?? ""));
    if (!product) return { error: `נא לבחור מוצר מהקטלוג לשורה ${Number(i) + 1}, או להוריד את הסימון שלה` };
    const entered = Number(form.get(own ? `usage_${i}` : `quantity_${i}`));
    if (!Number.isFinite(entered) || entered <= 0) {
      return {
        error: own ? `נא למלא את הצריכה ${periodWord} של "${product.name}"` : `נא למלא כמות ל"${product.name}"`,
      };
    }
    // במצב "הצריכה שלי" הכמות כבר חודשית; במצב החשבונית היא מוכפלת במספר החשבוניות בחודש
    const quantity = own ? monthlyFromUsage(entered, data.usagePeriod) : entered;
    const brand = String(form.get(`brand_${i}`) ?? "")
      .trim()
      .slice(0, 40);
    lines.push({
      productId: product.id,
      quantity,
      unitPriceAgorot: usePrices ? parseShekels(form.get(`price_${i}`)) : null,
      // הלקוח בחר "רק המותג הזה" במסך הבדיקה
      preferredBrand: brand && form.get(`brandOnly_${i}`) === "1" ? brand : null,
    });
  }
  if (lines.length === 0) return { error: "נא לסמן לפחות שורה אחת" };

  // אם שם הספק בחשבונית הוא של ספק רשום, מקשרים אליו כדי להשוות גם מול המחירון שלו
  const typedName = data.supplierName || null;
  const registered = typedName
    ? await db.supplier.findFirst({
        where: { companyName: { equals: typedName, mode: "insensitive" }, status: "APPROVED" },
      })
    : null;
  const volume = VOLUME_RANGES.find((r) => r.key === form.get("volume"));

  const basket = await db.basket.create({
    data: {
      customerId: customer.id,
      name: data.name,
      source: "INVOICE",
      deliveriesPerMonth: Math.max(1, Math.round(data.invoicesPerMonth)),
      currentSupplierId: registered?.id ?? null,
      currentSupplierName: registered?.companyName ?? typedName,
      monthlyVolumeMinAgorot: volume ? volume.min * 100 : null,
      monthlyVolumeMaxAgorot: volume?.max ? volume.max * 100 : null,
      items: { create: basketItemsFromInvoice(lines, own ? 1 : data.invoicesPerMonth) },
    },
  });
  await db.invoice.update({
    where: { id: invoice.id },
    data: { basketId: basket.id, supplierName: typedName, invoiceDate },
  });
  // התראה אחת על כל ההזדמנויות בחשבונית, ולא אחת לכל מוצר (אחרי שהלקוח כבר עבר לדף הסל)
  after(() => notifyInvoiceSavings(customer.id, basket.id, invoice.id, typedName));
  revalidatePath("/customer", "layout");
  redirect(`/customer/baskets/${basket.id}`);
}
