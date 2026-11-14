-- CreateEnum
CREATE TYPE "OfferChangeKind" AS ENUM ('BARCODE', 'SKU', 'NAME', 'PACK', 'BRAND', 'BRAND_REQUESTED', 'BRAND_APPROVED', 'BRAND_REJECTED', 'REPLACED', 'ARCHIVED', 'RESTORED');

-- AlterTable
ALTER TABLE "SupplierOffer" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "packChangedAt" TIMESTAMP(3),
ADD COLUMN     "pendingBrand" TEXT,
ADD COLUMN     "previousPackLabel" TEXT,
ADD COLUMN     "replacedById" TEXT;

-- CreateTable
CREATE TABLE "OfferChange" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "kind" "OfferChangeKind" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferChange_offerId_createdAt_idx" ON "OfferChange"("offerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "SupplierOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferChange" ADD CONSTRAINT "OfferChange_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
