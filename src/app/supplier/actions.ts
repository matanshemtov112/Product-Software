"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { checkImage } from "@/lib/supplier/images";
import { domainCategoryIds, supplierForUser } from "@/lib/supplier/catalog";
import { parseShekels, priceChangeStatus } from "@/lib/supplier/pricing-rules";

export interface FormState {
  error?: string;
}

const offerSchema = z.object({
  offerId: z.string().optional(),
  productName: z.string().trim().min(2, "נא למלא שם מוצר"),
  categoryId: z.string().min(1, "נא לבחור סוג מוצר"),
  unit: z.enum(["KG", "LITER", "UNIT"]),
  brand: z.string().trim().optional(),
  supplierSku: z.string().trim().optional(),
  supplierProductName: z.string().trim().max(80).optional(),
  packSize: z.coerce.number().positive("גודל אריזה חייב להיות חיובי"),
  minQuantity: z.coerce.number().min(0).default(0),
  available: z.literal("on").optional(),
});

async function currentSupplier() {
  const session = await requireRole("SUPPLIER");
  return supplierForUser(session.userId);
}

export async function saveOffer(_: FormState, form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const parsed = offerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const data = parsed.data;
  const image = await checkImage(form.get("image"));
  if (image && !image.ok) return { error: image.error };

  // ספק בלי מדרגות מקבל מדרגה בסיסית אחת
  const tiers = supplier.priceTiers.length
    ? supplier.priceTiers
    : [await db.priceTier.create({ data: { supplierId: supplier.id, name: "רגיל", minMonthlyAgorot: 0 } })];
  // לספק בלי מדרגות הטופס שולח את המחיר בשדה price_new
  const prices = tiers.map((t) => ({
    tier: t,
    agorot: parseShekels(form.get(`price_${t.id}`) ?? form.get("price_new")),
  }));
  if (prices[0].agorot === null) return { error: `נא למלא מחיר למדרגה "${tiers[0].name}"` };

  const existing = data.offerId
    ? await db.supplierOffer.findFirst({
        where: { id: data.offerId, supplierId: supplier.id },
        include: { prices: { where: { status: "LIVE", kind: "REGULAR" }, orderBy: { validFrom: "desc" } } },
      })
    : null;
  if (data.offerId && !existing) return { error: "המוצר לא נמצא" };

  let productId = existing?.productId;
  if (!existing) {
    const catalogProduct = await db.product.findUnique({ where: { name: data.productName } });
    const domains = await domainCategoryIds(supplier);
    if (domains && !domains.includes(catalogProduct?.categoryId ?? data.categoryId)) {
      return { error: "סוג המוצר הזה לא נמצא בתחומים שלך. אפשר להוסיף תחומים בפרטי הפרופיל." };
    }
    // מוצר חדש משויך לתת-תחום, לא לתחום ראשי שיש לו תתי-תחומים
    if (!catalogProduct && (await db.category.count({ where: { parentId: data.categoryId } })) > 0) {
      return { error: "נא לבחור סוג מוצר מדויק יותר" };
    }
    const product =
      catalogProduct ??
      (await db.product.create({
        data: { name: data.productName, categoryId: data.categoryId, unit: data.unit, pendingReview: true },
      }));
    if (await db.supplierOffer.findUnique({ where: { supplierId_productId: { supplierId: supplier.id, productId: product.id } } })) {
      return { error: "המוצר הזה כבר נמצא ברשימה שלך" };
    }
    productId = product.id;
  }

  const offerData = {
    brand: data.brand || null,
    supplierSku: data.supplierSku || null,
    supplierProductName: data.supplierProductName || null,
    packSize: data.packSize,
    minQuantity: data.minQuantity,
    available: data.available === "on",
  };
  const offer = existing
    ? await db.supplierOffer.update({ where: { id: existing.id }, data: offerData })
    : await db.supplierOffer.create({ data: { ...offerData, supplierId: supplier.id, productId: productId! } });

  if (image?.ok) await storeImage(offer.id, image);

  let held = 0;
  for (const { tier, agorot } of prices) {
    if (agorot === null) continue;
    const current = existing?.prices.find((p) => p.tierId === tier.id)?.unitPriceAgorot ?? null;
    if (current === agorot) continue;
    const status = priceChangeStatus(current, agorot);
    if (status === "PENDING_APPROVAL") held++;
    await db.offerPrice.create({ data: { offerId: offer.id, tierId: tier.id, unitPriceAgorot: agorot, status } });
  }

  revalidatePath("/supplier");
  redirect(held ? `/supplier/products/${offer.id}?held=${held}` : "/supplier");
}

async function storeImage(offerId: string, image: { data: Buffer; contentType: string }) {
  const data = new Uint8Array(image.data);
  await db.offerImage.upsert({
    where: { offerId },
    create: { offerId, data, contentType: image.contentType },
    update: { data, contentType: image.contentType },
  });
}

/** העלאה או החלפה של תמונה ישירות מרשימת המוצרים או מעמוד הפרטים */
export async function uploadOfferImage(form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  const offer = await db.supplierOffer.findFirst({ where: { id: offerId, supplierId: supplier.id } });
  if (!offer) return { error: "המוצר לא נמצא" };
  const image = await checkImage(form.get("image"));
  if (!image) return { error: "לא נבחרה תמונה" };
  if (!image.ok) return { error: image.error };
  await storeImage(offer.id, image);
  revalidatePath("/supplier", "layout");
  return {};
}

export async function removeOfferImage(form: FormData) {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  await db.offerImage.deleteMany({ where: { offerId, offer: { supplierId: supplier.id } } });
  revalidatePath("/supplier", "layout");
}

export async function deleteOffer(form: FormData) {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  await db.supplierOffer.deleteMany({ where: { id: offerId, supplierId: supplier.id } });
  revalidatePath("/supplier");
  redirect("/supplier");
}

const profileSchema = z.object({
  companyName: z.string().trim().min(2, "נא למלא שם חברה"),
  contactPhone: z.string().trim().optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().email("אימייל לא תקין")]).optional(),
  minOrder: z.coerce.number().min(0, "מינימום הזמנה לא יכול להיות שלילי"),
  paymentTermsDays: z.coerce.number().int().min(0).max(180),
});

export async function updateProfile(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const supplier = await currentSupplier();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const d = parsed.data;
  await db.supplier.update({
    where: { id: supplier.id },
    data: {
      companyName: d.companyName,
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      minOrderAgorot: Math.round(d.minOrder * 100),
      paymentTermsDays: d.paymentTermsDays,
    },
  });
  revalidatePath("/supplier", "layout");
  return { saved: true };
}

/** שמירת התחומים של הספק: בהגדרה הראשונה ומעמוד הפרופיל */
export async function saveDomains(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const supplier = await currentSupplier();
  const all = form.get("all") === "on";
  const requested = form.getAll("categoryId").map(String);
  const valid = all
    ? []
    : (await db.category.findMany({ where: { id: { in: requested } }, select: { id: true } })).map((c) => c.id);
  if (!all && valid.length === 0) return { error: "נא לבחור לפחות תחום אחד, או \"כל התחומים\"" };

  const firstTime = supplier.categoriesSetAt === null;
  await db.$transaction([
    db.supplierCategory.deleteMany({ where: { supplierId: supplier.id } }),
    db.supplierCategory.createMany({ data: valid.map((categoryId) => ({ supplierId: supplier.id, categoryId })) }),
    db.supplier.update({
      where: { id: supplier.id },
      data: { allCategories: all, categoriesSetAt: supplier.categoriesSetAt ?? new Date() },
    }),
  ]);
  revalidatePath("/supplier", "layout");
  if (firstTime) redirect("/supplier");
  return { saved: true };
}

const replySchema = z.object({
  inquiryId: z.string().min(1),
  reply: z.string().trim().min(2, "נא לכתוב תשובה ללקוח").max(1000, "התשובה ארוכה מדי (עד 1,000 תווים)"),
  status: z.enum(["OFFERED", "CLOSED"]),
});

/** תשובת הספק לפנייה של לקוח; הלקוח רואה אותה ברשימת הפניות שלו */
export async function replyInquiry(_: FormState, form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const { inquiryId, reply, status } = parsed.data;
  const { count } = await db.negotiationRequest.updateMany({
    where: { id: inquiryId, supplierId: supplier.id },
    data: { reply, status, repliedAt: new Date() },
  });
  if (!count) return { error: "הפנייה לא נמצאה" };
  revalidatePath("/supplier", "layout");
  redirect(`/supplier/inquiries/${inquiryId}`);
}

const rating = z.coerce.number().int().min(1, "נא לבחור דירוג").max(5);
const customerReviewSchema = z.object({
  customerId: z.string().min(1),
  inquiryId: z.string().min(1),
  overall: rating,
  payment: rating,
  communication: rating,
  text: z.string().trim().max(1000).optional(),
});

/** ביקורת של הספק על לקוח שפנה אליו; ביקורת אחת לכל לקוח, ושליחה חוזרת מעדכנת אותה */
export async function saveCustomerReview(_: FormState, form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const parsed = customerReviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "נא לדרג את כל שלושת הנושאים" };
  const { customerId, inquiryId, text, ...scores } = parsed.data;
  const inquiry = await db.negotiationRequest.findFirst({
    where: { id: inquiryId, supplierId: supplier.id, customerId },
    select: { id: true },
  });
  if (!inquiry) return { error: "אפשר לכתוב ביקורת רק על לקוח שפנה אליכם" };
  const data = { ...scores, text: text || null };
  await db.customerReview.upsert({
    where: { supplierId_customerId: { supplierId: supplier.id, customerId } },
    create: { supplierId: supplier.id, customerId, ...data },
    update: data,
  });
  revalidatePath(`/supplier/inquiries/${inquiryId}`);
  redirect(`/supplier/inquiries/${inquiryId}?reviewed=1`);
}
