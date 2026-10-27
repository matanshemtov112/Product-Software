-- AlterTable
ALTER TABLE "Basket" ADD COLUMN     "currentSupplierName" TEXT;

-- AlterTable
ALTER TABLE "NegotiationRequest" ADD COLUMN     "customerProfile" JSONB;
