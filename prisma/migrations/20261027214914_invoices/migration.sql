-- AlterEnum
ALTER TYPE "BasketSource" ADD VALUE 'INVOICE';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierName" TEXT,
    "invoiceDate" TEXT,
    "fileCount" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "basketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_customerId_createdAt_idx" ON "Invoice"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
