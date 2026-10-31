"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { checkImage } from "@/lib/supplier/images";
import { domainCategoryIds, supplierForUser } from "@/lib/supplier/catalog";
import { nominalPackSize } from "@/lib/pack";
import { parseShekels, priceChangeStatus } from "@/lib/supplier/pricing-rules";
import { VALID_DAYS } from "@/lib/matches";
import { parseTiers } from "@/lib/supplier/tiers";

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
  packType: z.enum(["", "UNIT", "CARTON", "CRATE", "SACK", "TIN", "BOTTLE", "PACK", "TRAY", "BUCKET"]).default(""),
  packSize: z.coerce.number().positive("גודל אריזה חייב להיות חיובי"),
  packSizeMax: z.union([z.literal(""), z.coerce.number().positive()]).optional(),
  minAmount: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  minIn: z.enum(["packs", "units"]).default("units"),
  pricePer: z.enum(["unit", "pack"]).default("unit"),
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
  // מחיר לאריזה נשמר כמחיר ליחידת בסיס, כדי שההשוואה תהיה תמיד לפי ק״ג/ליטר/יחידה
  // במשקל משתנה אין מחיר קבוע לאריזה, ולכן המחיר תמיד ליחידת המידה
  const variableWeight = typeof data.packSizeMax === "number" && data.packSizeMax > data.packSize;
  const perPack = data.pricePer === "pack" && data.packSize > 0 && !variableWeight;
  const packDivisor = perPack
    ? nominalPackSize({
        packSize: data.packSize,
        packSizeMax: typeof data.packSizeMax === "number" ? data.packSizeMax : null,
      })
    : 1;
  // לספק בלי מדרגות הטופס שולח את המחיר בשדה price_new
  const prices = tiers.map((t) => {
    const entered = parseShekels(form.get(`price_${t.id}`) ?? form.get("price_new"));
    return { tier: t, agorot: entered === null ? null : Math.round(entered / packDivisor) };
  });
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
    if (
      await db.supplierOffer.findUnique({
        where: { supplierId_productId: { supplierId: supplier.id, productId: product.id } },
      })
    ) {
      return { error: "המוצר הזה כבר נמצא ברשימה שלך" };
    }
    productId = product.id;
  }

  const minAmount = typeof data.minAmount === "number" ? data.minAmount : 0;
  const offerData = {
    brand: data.brand || null,
    supplierSku: data.supplierSku || null,
    supplierProductName: data.supplierProductName || null,
    packType: data.packType || null,
    packSize: data.packSize,
    // משקל משתנה: רק כשהטווח באמת גדל מהמשקל הנמוך
    packSizeMax: typeof data.packSizeMax === "number" && data.packSizeMax > data.packSize ? data.packSizeMax : null,
    minPacks: data.minIn === "packs" && minAmount > 0 ? Math.ceil(minAmount) : null,
    minQuantity: data.minIn === "units" ? minAmount : 0,
    available: data.available === "on",
    pricePerPack: perPack,
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
  description: z.string().trim().max(500, "התיאור ארוך מדי (עד 500 תווים)").optional(),
  openingHours: z.string().trim().max(120, "שעות הפעילות ארוכות מדי").optional(),
  deliveryTerms: z.string().trim().max(300, "תנאי האספקה ארוכים מדי").optional(),
});

export async function updateProfile(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const supplier = await currentSupplier();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const d = parsed.data;
  const logo = await checkImage(form.get("logo"));
  if (logo && !logo.ok) return { error: logo.error };
  if (logo?.ok) {
    const image = { data: new Uint8Array(logo.data), contentType: logo.contentType };
    await db.supplierLogo.upsert({
      where: { supplierId: supplier.id },
      create: { supplierId: supplier.id, ...image },
      update: image,
    });
  } else if (form.get("removeLogo") === "on") {
    await db.supplierLogo.deleteMany({ where: { supplierId: supplier.id } });
  }
  await db.supplier.update({
    where: { id: supplier.id },
    data: {
      description: d.description || null,
      openingHours: d.openingHours || null,
      deliveryTerms: d.deliveryTerms || null,
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
  if (!all && valid.length === 0) return { error: 'נא לבחור לפחות תחום אחד, או "כל התחומים"' };

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

/**
 * תשובת הספק לבקשת השוואה: לכל מוצר השוואה, הצעה נגדית או סירוב.
 * הצעה נגדית חייבת להיות נמוכה מהמחיר שהלקוח משלם היום. המחירים חלים על הלקוח הזה בלבד.
 */
export async function respondMatch(_: FormState, form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const requestId = String(form.get("requestId") ?? "");
  const request = await db.matchRequest.findFirst({
    where: { id: requestId, supplierId: supplier.id },
    include: { lines: true },
  });
  if (!request) return { error: "הבקשה לא נמצאה" };
  if (request.status === "CLOSED") return { error: "הלקוח כבר סגר את הבקשה" };
  const updates = [];
  for (const line of request.lines) {
    if (line.decision !== "PENDING") continue;
    const response = String(form.get(`response_${line.id}`) ?? "");
    if (response !== "MATCHED" && response !== "COUNTER" && response !== "DECLINED")
      return { error: `נא לבחור תשובה ל"${line.productName}"` };
    let counter: number | null = null;
    if (response === "COUNTER") {
      counter = parseShekels(form.get(`counter_${line.id}`));
      if (counter === null) return { error: `נא למלא מחיר להצעה הנגדית ל"${line.productName}"` };
      if (counter >= line.currentPriceAgorot)
        return { error: `ההצעה ל"${line.productName}" צריכה להיות נמוכה מהמחיר שהלקוח משלם היום` };
    }
    updates.push(
      db.matchRequestLine.update({
        where: { id: line.id },
        data: {
          // הצעה נגדית בדיוק במחיר המבוקש היא השוואה
          response: counter === line.targetPriceAgorot ? "MATCHED" : response,
          counterPriceAgorot: counter === line.targetPriceAgorot ? null : counter,
        },
      }),
    );
  }
  const note =
    String(form.get("note") ?? "")
      .trim()
      .slice(0, 1000) || null;
  const days = Number(form.get("validDays"));
  if (!VALID_DAYS.includes(days)) return { error: "נא לבחור עד מתי ההצעה בתוקף" };
  const validUntil = new Date(Date.now() + days * 86_400_000);
  await db.$transaction([
    ...updates,
    db.matchRequest.update({
      where: { id: request.id },
      data: { status: "ANSWERED", supplierNote: note, validUntil, answeredAt: new Date() },
    }),
  ]);
  revalidatePath("/supplier", "layout");
  redirect(`/supplier/matches/${request.id}?answered=1`);
}

/**
 * שמירת מדרגות המחיר של הספק. מדרגה שהוסרה נמחקת עם המחירים שלה;
 * במדרגה חדשה בלי מחיר, הלקוח מקבל את המחיר של המדרגה שמתחתיה.
 */
export async function saveTiers(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const supplier = await currentSupplier();
  const ids = form.getAll("tierId").map(String);
  const names = form.getAll("tierName").map(String);
  const mins = form.getAll("tierMin").map(String);
  const parsed = parseTiers(ids.map((id, i) => ({ id, name: names[i] ?? "", min: mins[i] ?? "" })));
  if (!parsed.ok) return { error: parsed.error };

  const existing = new Set(supplier.priceTiers.map((t) => t.id));
  if (parsed.tiers.some((t) => t.id && !existing.has(t.id))) return { error: "המדרגות השתנו בינתיים. נא לרענן את הדף" };
  const kept = parsed.tiers.filter((t) => t.id);
  const keptIds = new Set(kept.map((t) => t.id));
  await db.$transaction([
    db.priceTier.deleteMany({ where: { supplierId: supplier.id, id: { notIn: [...keptIds] as string[] } } }),
    // ערכים זמניים, כדי ששינוי סדר לא יתנגש בסף ייחודי
    ...kept.map((t, i) => db.priceTier.update({ where: { id: t.id! }, data: { minMonthlyAgorot: -1 - i } })),
    ...kept.map((t) =>
      db.priceTier.update({ where: { id: t.id! }, data: { name: t.name, minMonthlyAgorot: t.minMonthlyAgorot } }),
    ),
    ...parsed.tiers
      .filter((t) => !t.id)
      .map((t) =>
        db.priceTier.create({ data: { supplierId: supplier.id, name: t.name, minMonthlyAgorot: t.minMonthlyAgorot } }),
      ),
  ]);
  revalidatePath("/supplier", "layout");
  return { saved: true };
}
