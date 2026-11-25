"use server";

import type { SupplierStatus, Unit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { DOC_LABEL } from "@/lib/verification";
import { syncVerification } from "@/lib/verification-sync";
import { syncViolationStage } from "@/lib/price-violations-sync";
import { notify, notifyPriceChange } from "@/lib/notifications";
import { closeOpenPrices, lockOffer } from "@/lib/supplier/prices";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const STATUS_TEXT: Record<SupplierStatus, string> = {
  APPROVED: "החשבון שלכם אושר. המוצרים שלכם מופיעים עכשיו בהשוואות של הלקוחות.",
  REJECTED: "החשבון שלכם לא אושר. לפרטים נא לפנות לצוות הפלטפורמה.",
  PENDING: "החשבון שלכם חזר לבדיקה של צוות הפלטפורמה.",
  SUSPENDED: "החשבון שלכם הושעה, ולקוחות לא רואים אתכם בהשוואות. לפרטים נא לפנות לצוות הפלטפורמה.",
};

/** אישור, דחייה או השהיה של ספק */
export async function setSupplierStatus(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "supplierId");
  const status = str(form, "status") as SupplierStatus;
  if (!["APPROVED", "REJECTED", "PENDING", "SUSPENDED"].includes(status)) return;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.status === status) return;
  await db.supplier.update({ where: { id }, data: { status } });
  await audit({
    action: "supplier.status",
    targetType: "supplier",
    targetId: id,
    details: { supplier: supplier.companyName, from: supplier.status, to: status },
  });
  await notify([{ supplierId: id, kind: "ACCOUNT_STATUS", title: STATUS_TEXT[status], href: "/supplier" }]);
  revalidatePath("/admin", "layout");
}

/**
 * אישור או דחייה של שינוי מחיר גדול (מעל 30%). מחיר שאושר נכנס לתוקף עכשיו,
 * והלקוחות מקבלים התראה כמו על כל שינוי מחיר.
 */
export async function decidePrice(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "priceId");
  const approve = form.get("decision") === "approve";
  const price = await db.offerPrice.findUnique({
    where: { id },
    include: { tier: true, offer: { include: { product: true, supplier: true } } },
  });
  if (!price || price.status !== "PENDING_APPROVAL") return;
  const { offer } = price;
  const previous = await db.offerPrice.findFirst({
    where: { offerId: offer.id, tierId: price.tierId, status: "LIVE", kind: "REGULAR", validFrom: { lte: new Date() } },
    orderBy: { validFrom: "desc" },
  });
  const now = new Date();
  // מחיר עם תוקף או מבצע שהתאריך שלו כבר עבר לא נכנס לתוקף
  if (approve && price.validTo && price.validTo <= now) {
    await db.offerPrice.update({ where: { id }, data: { status: "REJECTED" } });
    revalidatePath("/admin", "layout");
    return;
  }
  // אישור בטרנזקציה עם נעילה על המוצר: המחיר הפתוח הקודם נסגר באותו רגע שהמאושר נכנס לתוקף
  const decided = await db.$transaction(async (tx) => {
    await lockOffer(tx, offer.id);
    const fresh = await tx.offerPrice.findUnique({ where: { id } });
    // בינתיים הספק שמר מחיר חדש, שהחליף את הבקשה הזו
    if (fresh?.status !== "PENDING_APPROVAL") return false;
    const at = new Date();
    if (approve)
      await closeOpenPrices(tx, { offerId: offer.id, tierId: price.tierId, kind: price.kind, at, exceptId: id });
    await tx.offerPrice.update({
      where: { id },
      data: approve ? { status: "LIVE", validFrom: at } : { status: "REJECTED" },
    });
    return true;
  });
  if (!decided) {
    revalidatePath("/admin", "layout");
    return;
  }
  await audit({
    action: approve ? "price.approved" : "price.rejected",
    targetType: "offer",
    targetId: offer.id,
    details: {
      supplier: offer.supplier.companyName,
      product: offer.product.name,
      from: previous?.unitPriceAgorot ?? null,
      to: price.unitPriceAgorot,
    },
  });
  const unit = UNIT_LABEL[offer.product.unit];
  await notify([
    {
      supplierId: offer.supplierId,
      kind: approve ? "PRICE_APPROVED" : "PRICE_REJECTED",
      title: `${approve ? "אושר" : "לא אושר"} המחיר החדש של ${offer.product.name}: ${shekels(price.unitPriceAgorot, 2)} ל${unit}`,
      body: approve
        ? "המחיר נכנס לתוקף ומופיע בהשוואות."
        : `המחיר הקודם${previous ? ` (${shekels(previous.unitPriceAgorot, 2)})` : ""} נשאר בתוקף. אפשר לעדכן שוב ברשימת המוצרים.`,
      href: `/supplier/products/${offer.id}`,
    },
  ]);
  if (approve && price.tier.minMonthlyAgorot === 0) {
    await notifyPriceChange({
      supplierId: offer.supplierId,
      supplierName: offer.supplier.companyName,
      productId: offer.productId,
      productName: offer.product.name,
      unitLabel: unit,
      oldAgorot: previous?.unitPriceAgorot ?? null,
      newAgorot: price.unitPriceAgorot,
    });
  }
  revalidatePath("/admin", "layout");
}

/**
 * שינוי מותג שהספק אומר שהוא אותו מוצר: אישור מעדכן את המותג וההיסטוריה ממשיכה,
 * דחייה משאירה את המותג הקודם (הספק יכול להכניס את המוצר כמוצר חלופי).
 */
export async function decideBrand(form: FormData) {
  await requireRole("ADMIN");
  const approve = form.get("decision") === "approve";
  const offer = await db.supplierOffer.findUnique({
    where: { id: str(form, "offerId") },
    include: { product: true, supplier: true },
  });
  if (!offer?.pendingBrand) return;
  await db.supplierOffer.update({
    where: { id: offer.id },
    data: {
      pendingBrand: null,
      ...(approve ? { brand: offer.pendingBrand } : {}),
      changes: {
        create: {
          kind: approve ? "BRAND_APPROVED" : "BRAND_REJECTED",
          oldValue: offer.brand,
          newValue: offer.pendingBrand,
        },
      },
    },
  });
  await audit({
    action: approve ? "brand.approved" : "brand.rejected",
    targetType: "offer",
    targetId: offer.id,
    details: {
      supplier: offer.supplier.companyName,
      product: offer.product.name,
      from: offer.brand,
      to: offer.pendingBrand,
    },
  });
  await notify([
    {
      supplierId: offer.supplierId,
      kind: approve ? "PRICE_APPROVED" : "PRICE_REJECTED",
      title: `${approve ? "אושר" : "לא אושר"} שינוי המותג של ${offer.product.name} ל-${offer.pendingBrand}`,
      body: approve
        ? "המותג עודכן, והיסטוריית המחירים ממשיכה."
        : `המותג ${offer.brand ?? "הקודם"} נשאר. אם הבאתם מוצר אחר במקום הקודם, ערכו את המוצר ובחרו ״מוצר חלופי״.`,
      href: `/supplier/products/${offer.id}`,
    },
  ]);
  revalidatePath("/admin", "layout");
}

/** עדכון מוצר בקטלוג; שמירה מסמנת אותו כנבדק, כך שהוא מופיע ללקוחות */
export async function updateProduct(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "productId");
  const name = str(form, "name");
  const categoryId = str(form, "categoryId");
  const unit = str(form, "unit") as Unit;
  const back = `/admin/products/${id}`;
  if (!name) redirect(`${back}?error=name`);
  if (!(unit in UNIT_LABEL)) redirect(`${back}?error=unit`);
  const clash = await db.product.findFirst({ where: { name, id: { not: id } } });
  if (clash) redirect(`${back}?error=duplicate`);
  if (!(await db.category.findUnique({ where: { id: categoryId } }))) redirect(`${back}?error=category`);
  const aliases = [
    ...new Set(
      str(form, "aliases")
        .split(/[,\n]/)
        .map((a) => a.trim())
        .filter((a) => a && a !== name),
    ),
  ];
  await db.product.update({
    where: { id },
    data: { name, categoryId, unit, spec: str(form, "spec") || null, aliases, pendingReview: false },
  });
  await audit({ action: "product.updated", targetType: "product", targetId: id, details: { name, aliases } });
  revalidatePath("/admin", "layout");
  redirect(`${back}?saved=1`);
}

/**
 * מיזוג מוצר כפול לתוך מוצר אחר: ההצעות של הספקים, הסלים וההתראות עוברים למוצר היעד,
 * השם של המוצר הכפול נשמר כשם נרדף, והמוצר הכפול נמחק.
 */
export async function mergeProduct(form: FormData) {
  await requireRole("ADMIN");
  const sourceId = str(form, "productId");
  const targetId = str(form, "targetId");
  if (!targetId || targetId === sourceId) redirect(`/admin/products/${sourceId}?error=target`);
  const [source, target] = await Promise.all([
    db.product.findUnique({ where: { id: sourceId }, include: { offers: true, basketItems: true } }),
    db.product.findUnique({ where: { id: targetId }, include: { offers: true, basketItems: true } }),
  ]);
  if (!source || !target) redirect("/admin/products");
  if (source.unit !== target.unit) redirect(`/admin/products/${sourceId}?error=merge-unit`);

  await db.$transaction(async (tx) => {
    const targetSuppliers = new Set(target.offers.map((o) => o.supplierId));
    for (const offer of source.offers) {
      // לספק כבר יש את מוצר היעד: ההצעה הכפולה נמחקת
      if (targetSuppliers.has(offer.supplierId)) await tx.supplierOffer.delete({ where: { id: offer.id } });
      else await tx.supplierOffer.update({ where: { id: offer.id }, data: { productId: targetId } });
    }
    const targetBaskets = new Set(target.basketItems.map((i) => i.basketId));
    for (const item of source.basketItems) {
      if (targetBaskets.has(item.basketId)) await tx.basketItem.delete({ where: { id: item.id } });
      else await tx.basketItem.update({ where: { id: item.id }, data: { productId: targetId } });
    }
    await tx.priceAlert.updateMany({ where: { productId: sourceId }, data: { productId: targetId } });
    await tx.matchRequestLine.updateMany({ where: { productId: sourceId }, data: { productId: targetId } });
    await tx.product.update({
      where: { id: targetId },
      data: {
        aliases: [...new Set([...target.aliases, source.name, ...source.aliases])].filter((a) => a !== target.name),
      },
    });
    await tx.product.delete({ where: { id: sourceId } });
  });
  await audit({
    action: "product.merged",
    targetType: "product",
    targetId,
    details: { from: source.name, into: target.name },
  });
  revalidatePath("/admin", "layout");
  redirect(`/admin/products/${targetId}?merged=1`);
}

export async function createCategory(form: FormData) {
  await requireRole("ADMIN");
  const name = str(form, "name");
  const parentId = str(form, "parentId") || null;
  if (!name) redirect("/admin/categories?error=name");
  if (await db.category.findUnique({ where: { name } })) redirect("/admin/categories?error=duplicate");
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } });
    // שתי רמות בלבד: תחום ראשי ותת-תחום
    if (!parent || parent.parentId) redirect("/admin/categories?error=parent");
  }
  const created = await db.category.create({ data: { name, parentId } });
  await audit({ action: "category.created", targetType: "category", targetId: created.id, details: { name } });
  revalidatePath("/admin/categories");
  redirect("/admin/categories?saved=1");
}

export async function renameCategory(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "categoryId");
  const name = str(form, "name");
  if (!name) redirect("/admin/categories?error=name");
  const clash = await db.category.findFirst({ where: { name, id: { not: id } } });
  if (clash) redirect("/admin/categories?error=duplicate");
  await db.category.update({ where: { id }, data: { name } });
  await audit({ action: "category.renamed", targetType: "category", targetId: id, details: { name } });
  revalidatePath("/admin/categories");
  redirect("/admin/categories?saved=1");
}

/** מחיקת סוג ריק בלבד: בלי מוצרים, בלי תתי-תחומים ובלי ספקים שבחרו בו */
export async function deleteCategory(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "categoryId");
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true, suppliers: true } } },
  });
  if (!category) return;
  const { products, children, suppliers } = category._count;
  if (products + children + suppliers > 0) redirect("/admin/categories?error=not-empty");
  await db.category.delete({ where: { id } });
  await audit({ action: "category.deleted", targetType: "category", targetId: id, details: { name: category.name } });
  revalidatePath("/admin/categories");
  redirect("/admin/categories?saved=1");
}

export async function setReviewStatus(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "reviewId");
  const status = form.get("status") === "PUBLISHED" ? "PUBLISHED" : "REJECTED";
  await db.review.update({ where: { id }, data: { status } });
  await audit({ action: "review.status", targetType: "review", targetId: id, details: { status } });
  revalidatePath("/admin", "layout");
}

/** סגירת דיווח: טופל או נסגר בלי פעולה, עם הערה פנימית */
export async function closeReport(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "reportId");
  const status = form.get("status") === "RESOLVED" ? "RESOLVED" : "DISMISSED";
  const resolution = str(form, "resolution").slice(0, 1000) || null;
  const report = await db.abuseReport.findUnique({ where: { id } });
  if (!report || report.status !== "OPEN") return;
  await db.abuseReport.update({ where: { id }, data: { status, resolution, resolvedAt: new Date() } });
  await audit({ action: "report.closed", targetType: "report", targetId: id, details: { status, resolution } });
  revalidatePath("/admin", "layout");
}

/** מנהל בודק דיווח על הפרת מחיר: מוצדק (נספר) או ביטול (לא נספר). השלב של הספק מתעדכן מיד */
export async function reviewViolation(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "reportId");
  const status = str(form, "status");
  if (status !== "CONFIRMED" && status !== "DISMISSED" && status !== "OPEN") return;
  const report = await db.priceViolationReport.findUnique({ where: { id } });
  if (!report) return;
  await db.priceViolationReport.update({
    where: { id },
    data: {
      status,
      adminNote: str(form, "note").slice(0, 300) || null,
      reviewedAt: status === "OPEN" ? null : new Date(),
    },
  });
  await audit({
    action: "violation.reviewed",
    targetType: "supplier",
    targetId: report.supplierId,
    details: { reportId: id, from: report.status, to: status, product: report.productName },
  });
  await syncViolationStage(report.supplierId);
  revalidatePath("/admin", "layout");
}

/** בדיקת מסמך אימות של ספק: אישור (אפשר לתקן את התוקף) או דחייה עם סיבה שהספק רואה */
export async function reviewDocument(form: FormData) {
  await requireRole("ADMIN");
  const id = str(form, "documentId");
  const decision = str(form, "decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") return;
  const doc = await db.supplierDocument.findUnique({
    where: { id },
    select: { id: true, kind: true, supplierId: true, validUntil: true },
  });
  if (!doc) return;
  const reason = str(form, "reason").slice(0, 300) || null;
  const rawDate = str(form, "validUntil");
  const validUntil = rawDate ? new Date(`${rawDate}T23:59:59`) : doc.validUntil;
  await db.supplierDocument.update({
    where: { id },
    data: {
      status: decision,
      rejectReason: decision === "REJECTED" ? (reason ?? "המסמך לא קריא או לא תואם לפרטי החברה") : null,
      validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
      reviewedAt: new Date(),
    },
  });
  if (decision === "REJECTED") {
    await notify([
      {
        supplierId: doc.supplierId,
        kind: "VERIFICATION",
        title: `המסמך "${DOC_LABEL[doc.kind]}" לא אושר`,
        body: reason ?? "המסמך לא קריא או לא תואם לפרטי החברה. העלו מסמך מעודכן.",
        href: "/supplier/verification",
      },
    ]);
  }
  await audit({
    action: "supplier.document_review",
    targetType: "supplier",
    targetId: doc.supplierId,
    details: { kind: DOC_LABEL[doc.kind], decision, reason },
  });
  await syncVerification(doc.supplierId);
  revalidatePath("/admin", "layout");
}
