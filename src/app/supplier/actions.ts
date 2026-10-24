"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
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
    const product =
      (await db.product.findUnique({ where: { name: data.productName } })) ??
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
    packSize: data.packSize,
    minQuantity: data.minQuantity,
    available: data.available === "on",
  };
  const offer = existing
    ? await db.supplierOffer.update({ where: { id: existing.id }, data: offerData })
    : await db.supplierOffer.create({ data: { ...offerData, supplierId: supplier.id, productId: productId! } });

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
