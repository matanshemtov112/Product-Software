-- AlterTable
ALTER TABLE "OfferPrice" ADD COLUMN     "termEndsAt" TIMESTAMP(3);

-- מבצעים קיימים: תאריך הסיום שנבחר הוא התוקף שלהם
UPDATE "OfferPrice" SET "termEndsAt" = "validTo" WHERE "kind" = 'PROMOTION' AND "validTo" IS NOT NULL;
