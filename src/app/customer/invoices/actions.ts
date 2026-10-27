"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { catalogForBasket } from "@/lib/customer/catalog";
import { customerForUser } from "@/lib/customer/quotes";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { db } from "@/lib/db";
import { basketItemsFromInvoice, type ConfirmedLine } from "@/lib/invoices/basket";
import { checkInvoiceFiles } from "@/lib/invoices/files";
import { claudeInvoiceReader, parseInvoice, type ReadResult } from "@/lib/invoices/read";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface InvoiceFormState {
  error?: string;
}

async function currentCustomer() {
  const session = await requireRole("CUSTOMER");
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
  const checked = await checkInvoiceFiles(form.getAll("pages"));
  if (!checked.ok) return { error: checked.error };

  const catalog = (await catalogForBasket()).map((c) => ({
    name: c.name,
    unit: c.unit as "KG" | "LITER" | "UNIT",
    category: c.parentCategory ? `${c.parentCategory} / ${c.category}` : c.category,
    aliases: c.aliases ?? [],
  }));
  const result = fakeReading(catalog.map((c) => c.name)) ?? (await claudeInvoiceReader(checked.files, catalog));

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
  const lines: ConfirmedLine[] = [];
  for (const i of rows) {
    const product = products.get(String(form.get(`product_${i}`) ?? ""));
    if (!product) return { error: `נא לבחור מוצר מהקטלוג לשורה ${Number(i) + 1}, או להוריד את הסימון שלה` };
    const quantity = Number(form.get(`quantity_${i}`));
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: `נא למלא כמות ל"${product.name}"` };
    lines.push({ productId: product.id, quantity, unitPriceAgorot: parseShekels(form.get(`price_${i}`)) });
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
      items: { create: basketItemsFromInvoice(lines, data.invoicesPerMonth) },
    },
  });
  await db.invoice.update({ where: { id: invoice.id }, data: { basketId: basket.id, supplierName: typedName } });
  revalidatePath("/customer", "layout");
  redirect(`/customer/baskets/${basket.id}`);
}
