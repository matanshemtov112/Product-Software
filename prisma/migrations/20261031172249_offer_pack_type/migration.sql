-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('UNIT', 'CARTON', 'CRATE', 'SACK', 'TIN', 'BOTTLE', 'PACK', 'TRAY', 'BUCKET');

-- AlterTable
ALTER TABLE "SupplierOffer" ADD COLUMN     "minPacks" INTEGER,
ADD COLUMN     "packSizeMax" DOUBLE PRECISION,
ADD COLUMN     "packType" "PackType";
