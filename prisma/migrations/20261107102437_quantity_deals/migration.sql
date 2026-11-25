-- CreateTable
CREATE TABLE "QuantityDeal" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "minPerOrder" DOUBLE PRECISION NOT NULL,
    "minPacks" INTEGER,
    "discountPct" DOUBLE PRECISION,
    "priceAgorot" INTEGER,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuantityDeal_offerId_key" ON "QuantityDeal"("offerId");

-- AddForeignKey
ALTER TABLE "QuantityDeal" ADD CONSTRAINT "QuantityDeal_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
