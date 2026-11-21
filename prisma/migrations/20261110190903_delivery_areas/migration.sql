-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DeliveryArea" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryArea_supplierId_idx" ON "DeliveryArea"("supplierId");

-- AddForeignKey
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
