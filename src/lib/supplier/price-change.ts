import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { notifyPriceChange } from "@/lib/notifications";
import { closeOpenPrices, lockOffer, priceVersion } from "./prices";
import { priceChangeStatus } from "./pricing-rules";

/**
 * שינוי של מחיר רגיל אחד (מדרגה אחת) של מוצר קיים, בלי לגעת בפרטי המוצר.
 * משמש את עוזר ה-AI של הספק. אותם כללים כמו בטופס העריכה (saveOffer):
 * נעילה על המוצר, סירוב כשהמחירים השתנו מאז שההצעה הוכנה (גרסה), שינוי של יותר מ-30% ממתין לאישור אדמין,
 * מחיר חדש סוגר את המחיר הקודם מאותו סוג (ההיסטוריה נשמרת), יומן פעולות והתראות ללקוחות.
 */

export interface RegularPriceChange {
  supplier: { id: string; companyName: string };
  offerId: string;
  tierId: string;
  /** המחיר החדש ליחידת בסיס (ק״ג/ליטר/יחידה), באגורות ללא מע״מ */
  agorot: number;
  /** סוף התוקף (תחילת היום שאחרי היום האחרון); null למחיר קבוע */
  validTo: Date | null;
  /** גרסת המחירים כשההצעה הוכנה; כשהיא השתנתה בינתיים, השינוי לא נשמר */
  version: string;
}

export type RegularPriceResult =
  | { ok: true; status: "LIVE" | "PENDING_APPROVAL" | "UNCHANGED"; previousAgorot: number | null }
  | { ok: false; error: string };

class Refused extends Error {}

export const STALE_PRICE_MESSAGE =
  "המחירים של המוצר השתנו מאז שהכנתי את ההצעה (אולי בלשונית אחרת או על ידי איש צוות אחר). בקשו ממני לבדוק שוב את המחיר העדכני.";

export async function changeRegularPrice(change: RegularPriceChange): Promise<RegularPriceResult> {
  const { supplier } = change;
  if (!Number.isInteger(change.agorot) || change.agorot <= 0) return { ok: false, error: "המחיר צריך להיות חיובי" };
  const offer = await db.supplierOffer.findFirst({
    where: { id: change.offerId, supplierId: supplier.id },
    include: { product: { select: { id: true, name: true, unit: true } } },
  });
  if (!offer) return { ok: false, error: "המוצר לא נמצא" };
  if (offer.archivedAt) return { ok: false, error: "המוצר בארכיון. אפשר להחזיר אותו מהארכיון ואז לעדכן מחיר." };
  const tier = await db.priceTier.findFirst({ where: { id: change.tierId, supplierId: supplier.id } });
  if (!tier) return { ok: false, error: "מדרגת המחיר לא נמצאה" };
  const baseTier = await db.priceTier.findFirst({
    where: { supplierId: supplier.id },
    orderBy: { minMonthlyAgorot: "asc" },
    select: { id: true },
  });

  let outcome: { status: "LIVE" | "PENDING_APPROVAL" | "UNCHANGED"; previous: number | null; before: number | null; after: number };
  try {
    outcome = await db.$transaction(
      async (tx) => {
        await lockOffer(tx, offer.id);
        if ((await priceVersion(tx, offer.id)) !== change.version) throw new Refused(STALE_PRICE_MESSAGE);
        const at = new Date();
        const live = await tx.offerPrice.findMany({
          where: {
            offerId: offer.id,
            tierId: tier.id,
            status: "LIVE",
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gt: at } }],
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        });
        const regular = live.find((p) => p.kind === "REGULAR") ?? null;
        const promo = live.find((p) => p.kind === "PROMOTION") ?? null;
        const previous = regular?.unitPriceAgorot ?? null;
        if (regular && previous === change.agorot && regular.validTo?.getTime() === change.validTo?.getTime()) {
          return { status: "UNCHANGED" as const, previous, before: previous, after: change.agorot };
        }
        const status = priceChangeStatus(previous, change.agorot);
        // מחיר חדש מחליף בקשה קודמת שעוד ממתינה לאישור, כדי שמנהל לא יאשר מחיר שהספק כבר שינה
        await tx.offerPrice.updateMany({
          where: { offerId: offer.id, tierId: tier.id, kind: "REGULAR", status: "PENDING_APPROVAL" },
          data: { status: "REJECTED" },
        });
        if (status === "LIVE") await closeOpenPrices(tx, { offerId: offer.id, tierId: tier.id, kind: "REGULAR", at });
        await tx.offerPrice.create({
          data: {
            offerId: offer.id,
            tierId: tier.id,
            unitPriceAgorot: change.agorot,
            status,
            kind: "REGULAR",
            validFrom: at,
            validTo: change.validTo,
            termEndsAt: change.validTo,
          },
        });
        // המחיר שהלקוח רואה: כשיש מבצע בתוקף, הזול מבין המבצע והמחיר הרגיל
        const before = promo && regular ? Math.min(promo.unitPriceAgorot, regular.unitPriceAgorot) : previous;
        const after = promo ? Math.min(promo.unitPriceAgorot, change.agorot) : change.agorot;
        return { status, previous, before, after };
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }

  if (outcome.status !== "UNCHANGED") {
    await audit({
      action: outcome.status === "LIVE" ? "price.changed" : "price.held",
      targetType: "offer",
      targetId: offer.id,
      details: {
        supplier: supplier.companyName,
        tier: tier.name,
        from: outcome.previous,
        to: change.agorot,
        type: change.validTo ? "UNTIL" : "FIXED",
        validTo: change.validTo?.toISOString() ?? null,
        via: "assistant",
      },
    });
  }
  if (outcome.status === "LIVE" && tier.id === baseTier?.id && outcome.before !== outcome.after) {
    await notifyPriceChange({
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      productId: offer.product.id,
      productName: offer.product.name,
      unitLabel: UNIT_LABEL[offer.product.unit],
      oldAgorot: outcome.before,
      newAgorot: outcome.after,
    });
  }
  return { ok: true, status: outcome.status, previousAgorot: outcome.previous };
}
