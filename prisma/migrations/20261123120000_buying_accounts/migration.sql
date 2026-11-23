-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "ownerSupplierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_ownerSupplierId_key" ON "Customer"("ownerSupplierId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerSupplierId_fkey" FOREIGN KEY ("ownerSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

