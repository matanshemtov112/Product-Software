-- DropIndex
DROP INDEX "SupplierOffer_supplierId_productId_key";

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierId_productId_idx" ON "SupplierOffer"("supplierId", "productId");
