-- מרכז התראות: קבוצות, הגדרות אישיות, אימייל, ריכוז הודעות וחסימת ספקים
-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('CRITICAL', 'SAVINGS', 'OFFERS', 'PRICES', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('OFF', 'INSTANT', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BlockMode" AS ENUM ('MUTE', 'BLOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'INVOICE_SAVINGS';
ALTER TYPE "NotificationKind" ADD VALUE 'STALE_SUPPLIER_PRICES';
ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_EXPIRING';
ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_EXPIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'NEW_INTEREST';
ALTER TYPE "NotificationKind" ADD VALUE 'EXPENSIVE_PRODUCTS';
ALTER TYPE "NotificationKind" ADD VALUE 'UPDATE_NEEDED';
ALTER TYPE "NotificationKind" ADD VALUE 'NEW_DEAL';

-- AlterTable
ALTER TABLE "MatchRequest" ADD COLUMN     "answerCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NegotiationRequest" ADD COLUMN     "replyCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "aboutSupplierId" TEXT,
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'CRITICAL',
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "groupCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "groupKey" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "blockFlaggedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" "NotificationFrequency" NOT NULL DEFAULT 'OFF',
    "lastDigestAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","category")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBlock" (
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "mode" "BlockMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBlock_pkey" PRIMARY KEY ("customerId","supplierId")
);

-- CreateIndex
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SupplierBlock_supplierId_createdAt_idx" ON "SupplierBlock"("supplierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_groupKey_key" ON "Notification"("groupKey");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBlock" ADD CONSTRAINT "SupplierBlock_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBlock" ADD CONSTRAINT "SupplierBlock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- התראות קיימות מקבלות את הקבוצה שלהן
UPDATE "Notification" SET "category" = 'SAVINGS' WHERE "kind" IN ('CHEAPER_SUPPLIER', 'MONTHLY_REPORT');
UPDATE "Notification" SET "category" = 'OFFERS' WHERE "kind" IN ('SUPPLIER_REPLIED', 'MATCH_ANSWERED', 'NEW_INQUIRY', 'NEW_MATCH_REQUEST', 'MATCH_DECIDED', 'OFFER_VIEWED', 'OFFER_DECIDED', 'OFFER_CANCELLED');
UPDATE "Notification" SET "category" = 'PRICES' WHERE "kind" IN ('PRICE_INCREASE', 'PRICE_DROP');
