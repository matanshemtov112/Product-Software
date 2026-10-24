"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { checkSnapshot } from "@/lib/customer/checks";
import { analyzeBasket, customerForUser, getBasket } from "@/lib/customer/quotes";
import { CUISINES } from "@/lib/customer/templates";
import { VOLUME_RANGES } from "@/lib/customer/volume";
import { db } from "@/lib/db";
import { OPEN_INQUIRY } from "@/lib/inquiries";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface FormState {
  error?: string;
}

async function currentCustomer() {
  const session = await requireRole("CUSTOMER");
  return customerForUser(session.userId);
}

/** הגדרה ראשונה: סוג המסעדה */
export async function saveCuisine(_: FormState, form: FormData): Promise<FormState> {
  const customer = await currentCustomer();
  const cuisine = String(form.get("cuisine") ?? "");
  if (!(CUISINES as readonly string[]).includes(cuisine)) return { error: "נא לבחור את סוג המסעדה" };
  await db.customer.update({ where: { id: customer.id }, data: { cuisine } });
  revalidatePath("/customer", "layout");
  redirect(String(form.get("next") ?? "") === "new" ? "/customer/baskets/new" : "/customer");
}

const basketSchema = z.object({
  basketId: z.string().optional(),
  name: z.string().trim().min(2, "נא לתת שם לסל").max(60),
  deliveriesPerMonth: z.coerce.number().int().min(1, "לפחות אספקה אחת בחודש").max(31),
  source: z.enum(["MANUAL", "CURRENT_SUPPLIER", "TEMPLATE"]),
  currentSupplierId: z.string().optional(),
});

/** יצירה או עדכון של סל: המוצרים, הכמות החודשית והמחיר שהלקוח משלם היום (לא חובה) */
export async function saveBasket(_: FormState, form: FormData): Promise<FormState> {
  const customer = await currentCustomer();
  const parsed = basketSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const data = parsed.data;

  const productIds = [...new Set(form.getAll("productId").map(String))];
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
  const items = [];
  for (const p of products) {
    const quantity = Number(form.get(`quantity_${p.id}`));
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: `נא למלא כמות חודשית ל"${p.name}"` };
    const price = parseShekels(form.get(`price_${p.id}`));
    items.push({ productId: p.id, monthlyQuantity: quantity, currentUnitPriceAgorot: price });
  }
  if (items.length === 0) return { error: "נא לבחור לפחות מוצר אחד" };

  const currentSupplierId =
    data.source === "CURRENT_SUPPLIER" && data.currentSupplierId
      ? (await db.supplier.findFirst({ where: { id: data.currentSupplierId, status: "APPROVED" } }))?.id ?? null
      : null;
  const volume = VOLUME_RANGES.find((r) => r.key === form.get("volume"));
  const fields = {
    name: data.name,
    monthlyVolumeMinAgorot: volume ? volume.min * 100 : null,
    monthlyVolumeMaxAgorot: volume?.max ? volume.max * 100 : null,
    deliveriesPerMonth: data.deliveriesPerMonth,
    source: data.source,
    currentSupplierId,
  };

  let basketId = data.basketId;
  if (basketId) {
    if (!(await getBasket(customer.id, basketId))) return { error: "הסל לא נמצא" };
    await db.$transaction([
      db.basketItem.deleteMany({ where: { basketId } }),
      db.basket.update({ where: { id: basketId }, data: { ...fields, items: { create: items } } }),
    ]);
  } else {
    basketId = (await db.basket.create({ data: { ...fields, customerId: customer.id, items: { create: items } } })).id;
  }
  revalidatePath("/customer", "layout");
  redirect(`/customer/baskets/${basketId}`);
}

/**
 * שמירת הסל לבדיקה חודשית, או עדכון הבדיקה: המחירים של היום נשמרים
 * כדי שבכניסה הבאה נראה מה השתנה אצל כל ספק.
 */
export async function recordCheck(form: FormData) {
  const customer = await currentCustomer();
  const basket = await getBasket(customer.id, String(form.get("basketId") ?? ""));
  if (!basket) redirect("/customer");
  const analysis = await analyzeBasket(basket.id);
  const best = analysis.result.lowestCost;
  await db.$transaction([
    db.optimizationRun.create({
      data: {
        basketId: basket.id,
        preference: customer.preference,
        result: JSON.parse(JSON.stringify(checkSnapshot(analysis))),
        bestCostAgorot: best?.totalAgorot ?? 0,
        savingsAgorot: analysis.result.monthlySavingsAgorot,
      },
    }),
    db.basket.update({ where: { id: basket.id }, data: { savedAt: basket.savedAt ?? new Date() } }),
  ]);
  revalidatePath("/customer", "layout");
  redirect(`/customer/baskets/${basket.id}?checked=${basket.savedAt ? "update" : "saved"}`);
}

export async function deleteBasket(form: FormData) {
  const customer = await currentCustomer();
  await db.basket.deleteMany({ where: { id: String(form.get("basketId") ?? ""), customerId: customer.id } });
  revalidatePath("/customer", "layout");
  redirect("/customer");
}

const inquirySchema = z.object({
  basketId: z.string().min(1),
  supplierId: z.string().min(1),
  message: z.string().trim().min(5, "נא לכתוב כמה מילים לספק").max(1000, "ההודעה ארוכה מדי (עד 1,000 תווים)"),
});

/**
 * פנייה לספק עם ההצעה שהלקוח קיבל. ההצעה והפער מחושבים מחדש כאן, ולא נלקחים מהטופס,
 * כדי שהספק יקבל את המספרים שהמערכת באמת הציגה.
 */
export async function sendInquiry(_: FormState, form: FormData): Promise<FormState> {
  const customer = await currentCustomer();
  const parsed = inquirySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const { basketId, supplierId, message } = parsed.data;

  const basket = await getBasket(customer.id, basketId);
  if (!basket) return { error: "הסל לא נמצא" };
  const row = (await analyzeBasket(basket.id)).rows.find((r) => r.supplierId === supplierId);
  if (!row) return { error: "הספק הזה לא מציע כרגע מוצרים מהסל שלך" };

  const open = await db.negotiationRequest.findFirst({
    where: { customerId: customer.id, supplierId, status: { in: OPEN_INQUIRY } },
  });
  if (open) return { error: "כבר שלחת פנייה לספק הזה והיא ממתינה לתשובה" };

  await db.negotiationRequest.create({
    data: {
      customerId: customer.id,
      supplierId,
      gapAgorot: row.quote.gapAgorot,
      totalAgorot: row.snapshot.totalAgorot,
      quote: JSON.parse(JSON.stringify(row.snapshot)),
      message,
    },
  });
  revalidatePath("/customer", "layout");
  redirect("/customer/inquiries?sent=1");
}
