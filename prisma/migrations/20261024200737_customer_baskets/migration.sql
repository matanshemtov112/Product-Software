-- CreateEnum
CREATE TYPE "BasketSource" AS ENUM ('MANUAL', 'CURRENT_SUPPLIER', 'TEMPLATE');

-- AlterTable
ALTER TABLE "Basket" ADD COLUMN     "currentSupplierId" TEXT,
ADD COLUMN     "savedAt" TIMESTAMP(3),
ADD COLUMN     "source" "BasketSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "cuisine" TEXT;

-- CreateIndex
CREATE INDEX "Basket_customerId_createdAt_idx" ON "Basket"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Basket" ADD CONSTRAINT "Basket_currentSupplierId_fkey" FOREIGN KEY ("currentSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
