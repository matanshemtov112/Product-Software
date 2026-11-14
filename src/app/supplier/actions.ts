"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { notify, notifyPriceChange } from "@/lib/notifications";
import { UNIT_LABEL } from "@/lib/format";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkImage } from "@/lib/supplier/images";
import { domainCategoryIds, supplierForUser } from "@/lib/supplier/catalog";
import { nominalPackSize, packLabel } from "@/lib/pack";
import { brandChangeNeedsDecision, diffOffer } from "@/lib/supplier/offer-changes";
import { closeOpenPrices, lockOffer, priceVersion } from "@/lib/supplier/prices";
import { parseShekels, parseValidUntil, priceChangeStatus, type PriceType } from "@/lib/supplier/pricing-rules";
import { NO_VALIDITY, offeredPrice, VALID_DAYS } from "@/lib/matches";
import { listUrl } from "@/lib/supplier/list-return";
import { canCancel, inquiryStage, matchStage, parseOutcomeNote } from "@/lib/offer-status";
import { parsePaymentTerms } from "@/lib/terms";
import { parseTiers } from "@/lib/supplier/tiers";
import { isManager } from "@/lib/auth/team";

export interface FormState {
  error?: string;
}

/** טופס עריכה שנפתח לפני שמירה אחרת של אותו מוצר */
class StaleFormError extends Error {}

const offerSchema = z.object({
  offerId: z.string().optional(),
  productName: z.string().trim().min(2, "נא למלא שם מוצר"),
  categoryId: z.string().min(1, "נא לבחור סוג מוצר"),
  unit: z.enum(["KG", "LITER", "UNIT"]),
  brand: z.string().trim().optional(),
  supplierSku: z.string().trim().optional(),
  barcode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9A-Za-z-]*$/, "ברקוד יכול להכיל רק ספרות ואותיות לועזיות")
    .optional(),
  brandChange: z.enum(["", "replacement", "same"]).default(""),
  supplierProductName: z.string().trim().max(80).optional(),
  packType: z.enum(["", "UNIT", "CARTON", "CRATE", "SACK", "TIN", "BOTTLE", "PACK", "TRAY", "BUCKET"]).default(""),
  packSize: z.coerce.number().positive("גודל אריזה חייב להיות חיובי"),
  packSizeMax: z.union([z.literal(""), z.coerce.number().positive()]).optional(),
  minAmount: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  minIn: z.enum(["packs", "units"]).default("units"),
  pricePer: z.enum(["unit", "pack"]).default("unit"),
  available: z.literal("on").optional(),
  priceType: z.enum(["FIXED", "UNTIL", "PROMOTION"]).default("FIXED"),
});

async function currentSupplier() {
  const session = await requireRole("SUPPLIER");
  return supplierForUser(session.userId);
}

const MANAGER_ONLY = "רק מנהל יכול לשנות את הפרטים האלה";

/** פעולות של מנהל: פרטי הספק, התחומים והמדרגות */
async function managedSupplier() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  return { supplier, manager: await isManager(session.userId) };
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
  const priceType: PriceType = data.priceType;
  const promotion = priceType === "PROMOTION";
  if (!promotion && prices[0].agorot === null) return { error: `נא למלא מחיר למדרגה "${tiers[0].name}"` };
  if (promotion && prices.every((p) => p.agorot === null)) return { error: "נא למלא מחיר מבצע לפחות למדרגה אחת" };
  const now = new Date();
  const validTo = priceType === "FIXED" ? null : parseValidUntil(form.get("validUntil"), now);
  if (priceType !== "FIXED" && !validTo) {
    return { error: `נא לבחור עד מתי ${promotion ? "המבצע" : "המחיר"} בתוקף: מהיום ועד שנה קדימה` };
  }

  // המחירים שבתוקף עכשיו (רגיל ומבצע), מהחדש לישן
  const existing = data.offerId
    ? await db.supplierOffer.findFirst({
        where: { id: data.offerId, supplierId: supplier.id },
        include: {
          product: { select: { unit: true } },
          prices: {
            where: { status: "LIVE", validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
            orderBy: { validFrom: "desc" },
          },
        },
      })
    : null;
  if (data.offerId && !existing) return { error: "המוצר לא נמצא" };
  if (existing?.archivedAt) return { error: "המוצר בארכיון. אפשר להחזיר אותו מהארכיון ואז לערוך." };
  // מותג אחר: לא מאחדים אוטומטית. הספק בוחר אם זה מוצר חלופי או אותו מוצר (שממתין לאישור מנהל)
  const brandDecision = existing && brandChangeNeedsDecision(existing.brand, data.brand ?? null);
  if (brandDecision && !data.brandChange) {
    return {
      error: `שיניתם את המותג מ-${existing.brand} ל-${data.brand || "בלי מותג"}. נא לבחור אם זה מוצר חלופי או אותו מוצר.`,
    };
  }
  const replacing = brandDecision && data.brandChange === "replacement" ? existing : null;
  const brandPending = brandDecision && data.brandChange === "same";
  if (brandPending && !data.brand) {
    return { error: "אי אפשר למחוק את המותג מאותו מוצר. אם המוצר הוחלף במוצר בלי מותג, בחרו ״מוצר חלופי״." };
  }
  if (replacing && promotion) {
    return { error: "מוצר חלופי נכנס עם מחיר קבוע או מחיר עם תוקף. אפשר להגדיר לו מבצע אחרי השמירה." };
  }
  // המוצר שמתעדכן: במוצר חלופי נוצר פריט חדש עם היסטוריה משלו, והישן עובר לארכיון
  const target = replacing ? null : existing;
  if (promotion) {
    if (!existing) return { error: "מבצע מגדירים למוצר קיים, אחרי שיש לו מחיר קבוע או מחיר עם תוקף" };
    for (const { tier, agorot } of prices) {
      if (agorot === null) continue;
      const regular = existing.prices.find((p) => p.tierId === tier.id && p.kind === "REGULAR");
      if (!regular) return { error: `אין מחיר רגיל למדרגה "${tier.name}", אז אי אפשר להגדיר לה מבצע` };
      if (agorot >= regular.unitPriceAgorot) {
        return { error: `מחיר המבצע במדרגה "${tier.name}" צריך להיות נמוך מהמחיר הרגיל` };
      }
    }
  }

  // מבצע כמות: מכמות מסוימת בהזמנה, אחוז הנחה או מחיר ליחידה
  let deal: {
    minPerOrder: number;
    minPacks: number | null;
    discountPct: number | null;
    priceAgorot: number | null;
    validTo: Date | null;
  } | null = null;
  if (form.get("dealEnabled") === "on") {
    const min = Number(form.get("dealMin"));
    if (!(min > 0)) return { error: "נא למלא מאיזו כמות בהזמנה חל מבצע הכמות" };
    const inPacks = form.get("dealMinIn") === "packs" && data.packSize > 0;
    const packSize = nominalPackSize({
      packSize: data.packSize,
      packSizeMax: typeof data.packSizeMax === "number" ? data.packSizeMax : null,
    });
    const value = Number(form.get("dealValue"));
    const pct = form.get("dealType") !== "price";
    if (pct && !(value > 0 && value <= 90)) return { error: "אחוז ההנחה במבצע הכמות צריך להיות בין 1 ל-90" };
    const dealAgorot = pct ? null : parseShekels(form.get("dealValue"));
    if (!pct && dealAgorot === null) return { error: "נא למלא את המחיר במבצע הכמות" };
    const dealUnit = dealAgorot === null ? null : Math.round(dealAgorot / packDivisor);
    const regularBase = promotion
      ? (existing?.prices.find((p) => p.tierId === tiers[0].id && p.kind === "REGULAR")?.unitPriceAgorot ?? null)
      : prices[0].agorot;
    if (dealUnit !== null && regularBase !== null && dealUnit >= regularBase) {
      return { error: "המחיר במבצע הכמות צריך להיות נמוך מהמחיר הרגיל" };
    }
    const until = form.get("dealUntil");
    const dealValidTo = until ? parseValidUntil(until, now) : null;
    if (until && !dealValidTo) return { error: "תאריך הסיום של מבצע הכמות צריך להיות מהיום ועד שנה קדימה" };
    deal = {
      minPerOrder: inPacks ? Math.round(min * packSize * 1000) / 1000 : min,
      minPacks: inPacks ? Math.ceil(min) : null,
      discountPct: pct ? value : null,
      priceAgorot: dealUnit,
      validTo: dealValidTo,
    };
  }

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
    productId = product.id;
  }
  // ספק יכול למכור את אותו מוצר בכמה אריזות, אבל לא את אותה אריזה פעמיים
  const samePack = await db.supplierOffer.findFirst({
    where: {
      supplierId: supplier.id,
      productId: productId!,
      packType: data.packType || null,
      packSize: data.packSize,
      archivedAt: null,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
  });
  if (samePack) {
    return {
      error: "האריזה הזו כבר נמצאת ברשימה שלך. אפשר לערוך אותה, או להוסיף את המוצר באריזה בגודל אחר.",
    };
  }

  const minAmount = typeof data.minAmount === "number" ? data.minAmount : 0;
  const offerData = {
    // שינוי מותג שממתין לאישור: המותג הקיים נשאר עד שהמנהל מאשר
    brand: brandPending ? existing!.brand : data.brand || null,
    ...(brandPending ? { pendingBrand: data.brand } : {}),
    barcode: data.barcode || null,
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
  // יומן שינויים: כל שינוי בפרטים המזהים נשמר; שינוי אריזה מסומן גם ללקוחות
  const unit = existing?.product.unit ?? data.unit;
  const packOf = (o: { packType: typeof offerData.packType; packSize: number; packSizeMax: number | null }) =>
    packLabel({ ...o, unit });
  const changes = target
    ? diffOffer(
        { ...target, pack: packOf(target) },
        { ...offerData, brand: data.brand || null, pack: packOf(offerData) },
      )
    : [];
  const packChange = changes.find((c) => c.kind === "PACK");
  // כל הכתיבה בטרנזקציה אחת עם נעילה על המוצר: לקוח לא רואה מצב חצי שמור (מדרגה אחת חדשה ואחת ישנה),
  // ושתי שמירות במקביל לא יוצרות שני מחירים פתוחים לאותה מדרגה
  const audits: Parameters<typeof audit>[0][] = [];
  const alerts: Parameters<typeof notifyPriceChange>[0][] = [];
  let held = 0;
  const formVersion = typeof form.get("priceVersion") === "string" ? String(form.get("priceVersion")) : null;
  let offer: { id: string; productId: string; brand: string | null };
  try {
    offer = await db.$transaction(
      async (tx) => {
        if (existing) await lockOffer(tx, existing.id);
        // טופס שנפתח לפני שמירה אחרת (לשונית נוספת, איש צוות אחר) לא דורס את המחירים החדשים
        if (existing && formVersion !== null && (await priceVersion(tx, existing.id)) !== formVersion) {
          throw new StaleFormError();
        }
        const at = new Date();
        // המחירים כפי שהם עכשיו, אחרי הנעילה (לא כפי שנקראו לפני השמירה)
        const livePrices = existing
          ? await tx.offerPrice.findMany({
              where: {
                offerId: existing.id,
                status: "LIVE",
                validFrom: { lte: at },
                OR: [{ validTo: null }, { validTo: { gt: at } }],
              },
              orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
            })
          : [];

        const saved = target
          ? await tx.supplierOffer.update({
              where: { id: target.id },
              data: {
                ...offerData,
                ...(packChange ? { packChangedAt: at, previousPackLabel: packChange.oldValue } : {}),
                changes: {
                  create: [
                    ...changes,
                    ...(brandPending
                      ? [{ kind: "BRAND_REQUESTED" as const, oldValue: target.brand, newValue: data.brand! }]
                      : []),
                  ],
                },
              },
            })
          : await tx.supplierOffer.create({ data: { ...offerData, supplierId: supplier.id, productId: productId! } });
        if (replacing) {
          await tx.supplierOffer.update({
            where: { id: replacing.id },
            data: {
              archivedAt: at,
              available: false,
              replacedById: saved.id,
              changes: { create: { kind: "REPLACED", oldValue: replacing.brand, newValue: saved.brand } },
            },
          });
          await tx.offerChange.create({
            data: { offerId: saved.id, kind: "REPLACED", oldValue: replacing.brand, newValue: saved.brand },
          });
          audits.push({
            action: "offer.replaced",
            targetType: "offer",
            targetId: saved.id,
            details: {
              supplier: supplier.companyName,
              product: data.productName,
              from: replacing.brand,
              to: saved.brand,
            },
          });
        }

        const previousDeal = await tx.quantityDeal.findUnique({ where: { offerId: saved.id } });
        if (deal) {
          await tx.quantityDeal.upsert({
            where: { offerId: saved.id },
            create: { ...deal, offerId: saved.id },
            update: deal,
          });
        } else if (previousDeal) {
          await tx.quantityDeal.delete({ where: { offerId: saved.id } });
        }
        if (deal || previousDeal) {
          const changed =
            !deal ||
            !previousDeal ||
            deal.minPerOrder !== previousDeal.minPerOrder ||
            deal.discountPct !== previousDeal.discountPct ||
            deal.priceAgorot !== previousDeal.priceAgorot ||
            deal.validTo?.getTime() !== previousDeal.validTo?.getTime();
          if (changed) {
            audits.push({
              action: deal ? "deal.saved" : "deal.removed",
              targetType: "offer",
              targetId: saved.id,
              details: {
                supplier: supplier.companyName,
                product: data.productName,
                ...(deal ? { ...deal, validTo: deal.validTo?.toISOString() ?? null } : {}),
              },
            });
          }
        }

        const kind = promotion ? "PROMOTION" : "REGULAR";
        for (const { tier, agorot } of prices) {
          if (agorot === null) continue;
          // במוצר חלופי ההשוואה היא מול המחיר של המוצר שהוחלף: שינוי של יותר מ-30% ממתין לאישור גם כאן
          const tierPrices = livePrices.filter((p) => p.tierId === tier.id);
          const regular = tierPrices.find((p) => p.kind === "REGULAR") ?? null;
          const promo = tierPrices.find((p) => p.kind === "PROMOTION") ?? null;
          const same = promotion ? promo : regular;
          if (!replacing && same && same.unitPriceAgorot === agorot && same.validTo?.getTime() === validTo?.getTime()) {
            continue;
          }
          // שינוי של יותר מ-30% ממתין לאישור; מבצע נבדק מול המחיר הרגיל
          const current = regular?.unitPriceAgorot ?? null;
          const status = priceChangeStatus(promotion ? current : (same?.unitPriceAgorot ?? null), agorot);
          if (status === "PENDING_APPROVAL") held++;
          // מחיר חדש מחליף בקשה קודמת שעוד ממתינה לאישור, כדי שמנהל לא יאשר מחיר שהספק כבר שינה
          await tx.offerPrice.updateMany({
            where: { offerId: saved.id, tierId: tier.id, kind, status: "PENDING_APPROVAL" },
            data: { status: "REJECTED" },
          });
          // מחיר שנכנס לתוקף סוגר קודם את המחיר הפתוח מאותו סוג, כדי שלא יהיו שניים פתוחים
          if (status === "LIVE") await closeOpenPrices(tx, { offerId: saved.id, tierId: tier.id, kind, at });
          await tx.offerPrice.create({
            data: {
              offerId: saved.id,
              tierId: tier.id,
              unitPriceAgorot: agorot,
              status,
              kind,
              validFrom: at,
              validTo,
              termEndsAt: validTo,
            },
          });
          audits.push({
            action: status === "LIVE" ? "price.changed" : "price.held",
            targetType: "offer",
            targetId: saved.id,
            details: {
              supplier: supplier.companyName,
              tier: tier.name,
              from: same?.unitPriceAgorot ?? null,
              to: agorot,
              type: priceType,
              validTo: validTo?.toISOString() ?? null,
            },
          });
          // התראות ללקוחות לפי המחיר הבסיסי, כשהמחיר נכנס לתוקף מיד (נשלחות אחרי שהשמירה הושלמה)
          const before = promo && regular ? Math.min(promo.unitPriceAgorot, regular.unitPriceAgorot) : current;
          const after = !promotion && promo ? Math.min(promo.unitPriceAgorot, agorot) : agorot;
          if (status === "LIVE" && tier.minMonthlyAgorot === 0 && before !== after) {
            alerts.push({
              supplierId: supplier.id,
              supplierName: supplier.companyName,
              productId: saved.productId,
              productName: data.productName,
              unitLabel: UNIT_LABEL[unit],
              oldAgorot: before,
              newAgorot: after,
            });
          }
        }
        return saved;
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    if (e instanceof StaleFormError) {
      return {
        error:
          "המחירים של המוצר השתנו מאז שפתחתם את הטופס (אולי בלשונית אחרת או על ידי איש צוות אחר). רעננו את הדף כדי לראות את המחירים העדכניים, ואז שמרו שוב.",
      };
    }
    throw e;
  }

  if (image?.ok) await storeImage(offer.id, image);
  for (const entry of audits) await audit(entry);
  for (const alert of alerts) await notifyPriceChange(alert);

  revalidatePath("/supplier");
  // חזרה לאותו מקום ברשימה (אותו חיפוש ותצוגה), עם גלילה למוצר שנשמר
  redirect(held ? `/supplier/products/${offer.id}?held=${held}` : listUrl(form.get("back"), offer.id));
}

async function storeImage(offerId: string, image: { data: Buffer; contentType: string }) {
  const data = new Uint8Array(image.data);
  await db.offerImage.upsert({
    where: { offerId },
    create: { offerId, data, contentType: image.contentType },
    update: { data, contentType: image.contentType },
  });
}

/** סיום מבצע לפני הזמן: המחיר הרגיל חוזר מיד */
export async function endPromotion(form: FormData) {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  const offer = await db.supplierOffer.findFirst({
    where: { id: offerId, supplierId: supplier.id },
    include: { product: true },
  });
  if (!offer) return;
  const now = new Date();
  const ended = await db.offerPrice.updateMany({
    where: {
      offerId,
      kind: "PROMOTION",
      status: "LIVE",
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    data: { validTo: now },
  });
  if (ended.count) {
    await audit({
      action: "price.promotion-ended",
      targetType: "offer",
      targetId: offerId,
      details: { supplier: supplier.companyName, product: offer.product.name },
    });
  }
  revalidatePath("/supplier", "layout");
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

/** "מחיקה" מעבירה לארכיון: המוצר יוצא מההשוואות, וההיסטוריה שלו (מחירים, ברקודים, שינויים) נשמרת */
export async function deleteOffer(form: FormData) {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  const offer = await db.supplierOffer.findFirst({ where: { id: offerId, supplierId: supplier.id, archivedAt: null } });
  if (offer) {
    await db.supplierOffer.update({
      where: { id: offer.id },
      data: { archivedAt: new Date(), available: false, changes: { create: { kind: "ARCHIVED" } } },
    });
  }
  revalidatePath("/supplier", "layout");
  if (!form.get("stay")) redirect("/supplier");
}

/** החזרה מהארכיון: המוצר חוזר לרשימה (לא זמין עד שהספק מסמן אותו), עם כל ההיסטוריה */
export async function restoreOffer(form: FormData) {
  const supplier = await currentSupplier();
  const offerId = String(form.get("offerId") ?? "");
  const offer = await db.supplierOffer.findFirst({
    where: { id: offerId, supplierId: supplier.id, archivedAt: { not: null } },
  });
  if (!offer) redirect("/supplier/archive");
  const samePack = await db.supplierOffer.findFirst({
    where: {
      supplierId: supplier.id,
      productId: offer.productId,
      packType: offer.packType,
      packSize: offer.packSize,
      archivedAt: null,
    },
  });
  if (samePack) redirect(`/supplier/archive?conflict=${offer.id}`);
  await db.supplierOffer.update({
    where: { id: offer.id },
    data: { archivedAt: null, changes: { create: { kind: "RESTORED" } } },
  });
  revalidatePath("/supplier", "layout");
  redirect(`/supplier/products/${offer.id}`);
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
  const { supplier, manager } = await managedSupplier();
  if (!manager) return { error: MANAGER_ONLY };
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
      paymentTermsPerCustomer: form.get("paymentTermsMode") === "perCustomer",
    },
  });
  revalidatePath("/supplier", "layout");
  return { saved: true };
}

/** שמירת התחומים של הספק: בהגדרה הראשונה ומעמוד הפרופיל */
export async function saveDomains(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const { supplier, manager } = await managedSupplier();
  if (!manager && supplier.categoriesSetAt !== null) return { error: MANAGER_ONLY };
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

const NO_MATCH_NOTE = "הספק לא יכול להתאים את המחיר";

/** תוקף שהספק בחר להצעה: תאריך, null כשבחר "בלי תוקף", או undefined כשהערך לא מהרשימה */
function parseValidDays(value: FormDataEntryValue | null): Date | null | undefined {
  const days = Number(value ?? NO_VALIDITY);
  if (days === NO_VALIDITY) return null;
  if (!VALID_DAYS.includes(days)) return undefined;
  return new Date(Date.now() + days * 86_400_000);
}

/** תשובת הספק לפנייה של לקוח; הלקוח רואה אותה ברשימת הפניות שלו */
export async function replyInquiry(_: FormState, form: FormData): Promise<FormState> {
  const supplier = await currentSupplier();
  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const { inquiryId, reply, status } = parsed.data;
  const paymentTermsDays = parsePaymentTerms(form.get("paymentTerms"));
  if (paymentTermsDays === undefined) return { error: "נא לבחור תנאי תשלום מהרשימה" };
  const validUntil = parseValidDays(form.get("validDays"));
  if (validUntil === undefined) return { error: "נא לבחור תוקף להצעה, או בלי תוקף" };
  const inquiry = await db.negotiationRequest.findFirst({ where: { id: inquiryId, supplierId: supplier.id } });
  if (!inquiry) return { error: "הפנייה לא נמצאה" };
  if (inquiry.outcome) return { error: "הפנייה כבר הסתיימה, ואי אפשר לשלוח עליה הצעה" };
  const now = new Date();
  await db.negotiationRequest.update({
    where: { id: inquiryId },
    data: {
      reply,
      status,
      paymentTermsDays,
      validUntil: status === "OFFERED" ? validUntil : null,
      repliedAt: now,
      // הצעה מעודכנת עוד לא נצפתה; "לא נוכל להתאים" סוגר את הפנייה
      offerSeenAt: null,
      ...(status === "CLOSED"
        ? {
            outcome: "CANCELLED" as const,
            cancelledBy: "SUPPLIER" as const,
            outcomeAt: now,
            outcomeNote: NO_MATCH_NOTE,
          }
        : {}),
    },
  });
  await notify([
    {
      customerId: inquiry.customerId,
      kind: "SUPPLIER_REPLIED",
      title: `${supplier.companyName} השיב לפנייה שלכם`,
      body: reply.length > 140 ? `${reply.slice(0, 140)}…` : reply,
      href: `/customer/inquiries/${inquiryId}`,
    },
  ]);
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
  if (request.status === "CLOSED" || request.outcome) return { error: "הבקשה כבר הסתיימה" };
  const updates = [];
  for (const line of request.lines) {
    if (line.decision !== "PENDING") continue;
    const response = String(form.get(`response_${line.id}`) ?? "");
    if (response !== "MATCHED" && response !== "COUNTER" && response !== "DECLINED")
      return { error: `נא לבחור תשובה ל"${line.productName}"` };
    // ב"מתחת לסף" אין "משווה": הספק לא ראה את המחיר שנמצא
    if (request.reveal === "CEILING" && response === "MATCHED")
      return { error: `נא לרשום את המחיר שלכם ל"${line.productName}"` };
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
        data: (() => {
          // הצעה נגדית בדיוק במחיר המבוקש היא השוואה. ב"מתחת לסף" הספק לא ראה את המחיר, ולכן ההצעה נשארת שלו
          const same = request.reveal === "EXACT" && counter === line.targetPriceAgorot;
          return { response: same ? ("MATCHED" as const) : response, counterPriceAgorot: same ? null : counter };
        })(),
      }),
    );
  }
  const note =
    String(form.get("note") ?? "")
      .trim()
      .slice(0, 1000) || null;
  // תוקף להצעה הוא בחירה של הספק: אפשר גם בלי תוקף
  const validUntil = parseValidDays(form.get("validDays"));
  if (validUntil === undefined) return { error: "נא לבחור תוקף להצעה, או בלי תוקף" };
  const paymentTermsDays = parsePaymentTerms(form.get("paymentTerms"));
  if (paymentTermsDays === undefined) return { error: "נא לבחור תנאי תשלום מהרשימה" };
  // סירוב לכל המוצרים (בלי מחיר שאושר קודם) סוגר את הבקשה כ"בוטלה" מצד הספק
  const offersAny = request.lines.some((l) =>
    l.decision === "PENDING" ? String(form.get(`response_${l.id}`)) !== "DECLINED" : offeredPrice(l) !== null,
  );
  const now = new Date();
  await db.$transaction([
    ...updates,
    db.matchRequest.update({
      where: { id: request.id },
      data: {
        status: "ANSWERED",
        supplierNote: note,
        validUntil,
        paymentTermsDays,
        answeredAt: now,
        offerSeenAt: null,
        ...(offersAny
          ? {}
          : {
              outcome: "CANCELLED" as const,
              cancelledBy: "SUPPLIER" as const,
              outcomeAt: now,
              outcomeNote: NO_MATCH_NOTE,
            }),
      },
    }),
  ]);
  await notify([
    {
      customerId: request.customerId,
      kind: "MATCH_ANSWERED",
      title: `${supplier.companyName} השיב לבקשת ההשוואה שלכם`,
      body: "אשרו או דחו את המחירים שהספק הציע.",
      href: `/customer/matches/${request.id}`,
    },
  ]);
  revalidatePath("/supplier", "layout");
  redirect(`/supplier/matches/${request.id}?answered=1`);
}

/**
 * שמירת מדרגות המחיר של הספק. מדרגה שהוסרה נמחקת עם המחירים שלה;
 * במדרגה חדשה בלי מחיר, הלקוח מקבל את המחיר של המדרגה שמתחתיה.
 */
export async function saveTiers(_: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const { supplier, manager } = await managedSupplier();
  if (!manager) return { error: MANAGER_ONLY };
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

/** הספק מושך הצעה שהלקוח עוד לא קיבל או דחה (פנייה או בקשת השוואה) */
export async function withdrawOffer(form: FormData) {
  const supplier = await currentSupplier();
  const id = String(form.get("id") ?? "");
  const isMatch = form.get("kind") === "match";
  const note = parseOutcomeNote(form.get("note"));
  const data = {
    outcome: "CANCELLED" as const,
    cancelledBy: "SUPPLIER" as const,
    outcomeAt: new Date(),
    outcomeNote: note,
    status: "CLOSED" as const,
  };
  if (isMatch) {
    const request = await db.matchRequest.findFirst({ where: { id, supplierId: supplier.id } });
    if (!request || !canCancel(matchStage(request), "SUPPLIER")) redirect(`/supplier/matches/${id}`);
    await db.matchRequest.update({ where: { id }, data });
    await notify([
      {
        customerId: request.customerId,
        kind: "OFFER_CANCELLED",
        title: `${supplier.companyName} ביטלו את ההצעה שלהם לבקשת ההשוואה`,
        body: note ?? undefined,
        href: `/customer/matches/${id}`,
        dedupeKey: `offer-cancelled:match:${id}`,
      },
    ]);
  } else {
    const inquiry = await db.negotiationRequest.findFirst({ where: { id, supplierId: supplier.id } });
    if (!inquiry || !canCancel(inquiryStage(inquiry), "SUPPLIER")) redirect(`/supplier/inquiries/${id}`);
    await db.negotiationRequest.update({ where: { id }, data });
    await notify([
      {
        customerId: inquiry.customerId,
        kind: "OFFER_CANCELLED",
        title: `${supplier.companyName} ביטלו את ההצעה שלהם`,
        body: note ?? undefined,
        href: `/customer/inquiries/${id}`,
        dedupeKey: `offer-cancelled:inquiry:${id}`,
      },
    ]);
  }
  revalidatePath("/supplier", "layout");
  redirect(isMatch ? `/supplier/matches/${id}` : `/supplier/inquiries/${id}`);
}
