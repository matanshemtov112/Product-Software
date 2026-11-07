import { db } from "@/lib/db";

/**
 * סוגר את המחירים הקודמים מאותו סוג ומאותה מדרגה שעוד בתוקף, כשמחיר חדש נכנס לתוקף.
 * כך מחיר ישן לא חוזר כשמחיר עם תוקף פג.
 */
export async function closePrevious(price: {
  id: string;
  offerId: string;
  tierId: string;
  kind: "REGULAR" | "PROMOTION";
  validFrom: Date;
}) {
  await db.offerPrice.updateMany({
    where: {
      offerId: price.offerId,
      tierId: price.tierId,
      kind: price.kind,
      status: "LIVE",
      id: { not: price.id },
      validFrom: { lte: price.validFrom },
      OR: [{ validTo: null }, { validTo: { gt: price.validFrom } }],
    },
    data: { validTo: price.validFrom },
  });
}
