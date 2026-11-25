-- CreateEnum
CREATE TYPE "KosherLevel" AS ENUM ('NONE', 'KOSHER', 'MEHADRIN');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "kosherRequired" "KosherLevel" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "kosherAuthority" TEXT,
ADD COLUMN     "kosherDefault" "KosherLevel";

-- AlterTable
ALTER TABLE "SupplierOffer" ADD COLUMN     "kosher" "KosherLevel",
ADD COLUMN     "kosherAuthority" TEXT;

