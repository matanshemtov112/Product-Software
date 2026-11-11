-- AlterTable
ALTER TABLE "DeliveryArea" ADD COLUMN     "deliveryDays" TEXT,
ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "orderCutoff" TEXT;

-- AlterTable
ALTER TABLE "MatchRequest" ADD COLUMN     "paymentTermsDays" INTEGER;

-- AlterTable
ALTER TABLE "NegotiationRequest" ADD COLUMN     "paymentTermsDays" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "paymentTermsPerCustomer" BOOLEAN NOT NULL DEFAULT false;
