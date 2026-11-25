-- CreateTable
CREATE TABLE "CustomerReview" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "payment" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerReview_customerId_updatedAt_idx" ON "CustomerReview"("customerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReview_supplierId_customerId_key" ON "CustomerReview"("supplierId", "customerId");

-- AddForeignKey
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
