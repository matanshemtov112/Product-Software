-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SupplierOffer" ADD COLUMN     "supplierProductName" TEXT;
