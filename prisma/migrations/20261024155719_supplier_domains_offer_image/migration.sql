-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "allCategories" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categoriesSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OfferImage" (
    "offerId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferImage_pkey" PRIMARY KEY ("offerId")
);

-- AddForeignKey
ALTER TABLE "OfferImage" ADD CONSTRAINT "OfferImage_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ספקים קיימים שכבר יש להם תחומים לא צריכים לעבור את ההגדרה הראשונה
UPDATE "Supplier" SET "categoriesSetAt" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "SupplierCategory" sc WHERE sc."supplierId" = "Supplier"."id");
