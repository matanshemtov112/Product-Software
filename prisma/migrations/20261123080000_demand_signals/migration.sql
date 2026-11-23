-- CreateEnum
CREATE TYPE "DemandKind" AS ENUM ('PRICE_CHECK', 'INVOICE', 'PHOTO_SEARCH');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DEMAND_RISING';

-- CreateTable
CREATE TABLE "DemandSignal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "DemandKind" NOT NULL,
    "hasSupplier" BOOLEAN NOT NULL DEFAULT false,
    "day" DATE NOT NULL,

    CONSTRAINT "DemandSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandSignal_day_idx" ON "DemandSignal"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DemandSignal_customerId_productId_kind_day_key" ON "DemandSignal"("customerId", "productId", "kind", "day");

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

