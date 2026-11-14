import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

/**
 * סוגר את המחירים מאותו סוג ומאותה מדרגה שבתוקף ברגע at, לפני שמחיר חדש נכנס לתוקף באותו רגע.
 * כך לעולם אין שני מחירים פתוחים לאותה מדרגה, ומחיר ישן לא חוזר כשמחיר עם תוקף פג.
 */
export async function closeOpenPrices(
  client: Client,
  price: { offerId: string; tierId: string; kind: "REGULAR" | "PROMOTION"; at: Date; exceptId?: string },
) {
  await client.offerPrice.updateMany({
    where: {
      offerId: price.offerId,
      tierId: price.tierId,
      kind: price.kind,
      status: "LIVE",
      ...(price.exceptId ? { id: { not: price.exceptId } } : {}),
      validFrom: { lte: price.at },
      OR: [{ validTo: null }, { validTo: { gt: price.at } }],
    },
    data: { validTo: price.at },
  });
}

/**
 * נעילה על מוצר של ספק עד סוף הטרנזקציה: שמירות במקביל של אותו מוצר (שתי לשוניות, ספק ומנהל)
 * רצות אחת אחרי השנייה, וכל אחת רואה את המחירים שהקודמת שמרה.
 */
export async function lockOffer(tx: Prisma.TransactionClient, offerId: string) {
  await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE id = ${offerId} FOR UPDATE`;
}

/** הגרסה של המחירים במוצר: המזהה של שורת המחיר האחרונה. טופס שנפתח בגרסה אחרת לא ידרוס מחירים חדשים */
export async function priceVersion(client: Client, offerId: string): Promise<string> {
  const latest = await client.offerPrice.findFirst({
    where: { offerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return latest?.id ?? "";
}
