-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'PRICE_VIOLATION';

-- AlterEnum
ALTER TYPE "SupplierStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "reliabilityBeforePenalty" DOUBLE PRECISION,
ADD COLUMN     "violationStage" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PriceViolationReport" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "shownPriceAgorot" INTEGER NOT NULL,
    "chargedPriceAgorot" INTEGER NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "status" "ViolationStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceViolationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceViolationReport_supplierId_createdAt_idx" ON "PriceViolationReport"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceViolationReport_status_createdAt_idx" ON "PriceViolationReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PriceViolationReport_customerId_supplierId_productId_create_idx" ON "PriceViolationReport"("customerId", "supplierId", "productId", "createdAt");

-- AddForeignKey
ALTER TABLE "PriceViolationReport" ADD CONSTRAINT "PriceViolationReport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceViolationReport" ADD CONSTRAINT "PriceViolationReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
