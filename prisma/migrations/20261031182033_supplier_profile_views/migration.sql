-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "deliveryTerms" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "openingHours" TEXT;

-- CreateTable
CREATE TABLE "SupplierLogo" (
    "supplierId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierLogo_pkey" PRIMARY KEY ("supplierId")
);

-- CreateTable
CREATE TABLE "SupplierView" (
    "supplierId" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "SupplierView_pkey" PRIMARY KEY ("supplierId","basketId","day")
);

-- CreateIndex
CREATE INDEX "SupplierView_supplierId_day_idx" ON "SupplierView"("supplierId", "day");

-- AddForeignKey
ALTER TABLE "SupplierLogo" ADD CONSTRAINT "SupplierLogo_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierView" ADD CONSTRAINT "SupplierView_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
