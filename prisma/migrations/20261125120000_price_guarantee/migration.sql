-- CreateEnum
CREATE TYPE "GuaranteeChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'GUARANTEE_BREACH';
ALTER TYPE "NotificationKind" ADD VALUE 'GUARANTEE_CHANGE_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'GUARANTEE_CHANGE_DECIDED';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "PriceGuarantee" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "inquiryId" TEXT,
    "matchRequestId" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "guaranteedUntil" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "PriceGuarantee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeLine" (
    "id" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "packLabel" TEXT,
    "monthlyQuantity" DOUBLE PRECISION,
    "unitPriceAgorot" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GuaranteeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeChange" (
    "id" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "oldAgorot" INTEGER NOT NULL,
    "newAgorot" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "GuaranteeChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "GuaranteeChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeBreach" (
    "id" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceDate" TEXT,
    "guaranteedAgorot" INTEGER NOT NULL,
    "chargedAgorot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuaranteeBreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceGuarantee_number_key" ON "PriceGuarantee"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PriceGuarantee_inquiryId_key" ON "PriceGuarantee"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceGuarantee_matchRequestId_key" ON "PriceGuarantee"("matchRequestId");

-- CreateIndex
CREATE INDEX "PriceGuarantee_customerId_supplierId_guaranteedUntil_idx" ON "PriceGuarantee"("customerId", "supplierId", "guaranteedUntil");

-- CreateIndex
CREATE INDEX "PriceGuarantee_supplierId_guaranteedUntil_idx" ON "PriceGuarantee"("supplierId", "guaranteedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "GuaranteeLine_guaranteeId_productId_key" ON "GuaranteeLine"("guaranteeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "GuaranteeBreach_invoiceId_lineId_key" ON "GuaranteeBreach"("invoiceId", "lineId");

-- AddForeignKey
ALTER TABLE "PriceGuarantee" ADD CONSTRAINT "PriceGuarantee_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceGuarantee" ADD CONSTRAINT "PriceGuarantee_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceGuarantee" ADD CONSTRAINT "PriceGuarantee_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "NegotiationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceGuarantee" ADD CONSTRAINT "PriceGuarantee_matchRequestId_fkey" FOREIGN KEY ("matchRequestId") REFERENCES "MatchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeLine" ADD CONSTRAINT "GuaranteeLine_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "PriceGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeChange" ADD CONSTRAINT "GuaranteeChange_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "PriceGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeChange" ADD CONSTRAINT "GuaranteeChange_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "GuaranteeLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeBreach" ADD CONSTRAINT "GuaranteeBreach_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "PriceGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeBreach" ADD CONSTRAINT "GuaranteeBreach_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "GuaranteeLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

