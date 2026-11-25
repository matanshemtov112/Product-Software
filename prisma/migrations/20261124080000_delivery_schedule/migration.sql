-- CreateEnum
CREATE TYPE "DeliverySchedule" AS ENUM ('BY_AREA', 'PER_WEEK');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "deliveriesPerWeek" INTEGER,
ADD COLUMN     "deliverySchedule" "DeliverySchedule";

