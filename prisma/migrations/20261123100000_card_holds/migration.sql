-- CreateEnum
CREATE TYPE "CardHoldStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'FAILED', 'RELEASED', 'CAPTURED');

-- CreateTable
CREATE TABLE "CardHold" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "amountAgorot" INTEGER NOT NULL,
    "status" "CardHoldStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "cardLast4" TEXT,
    "failureReason" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "capturedAgorot" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardHold_inquiryId_idx" ON "CardHold"("inquiryId");

-- CreateIndex
CREATE INDEX "CardHold_status_createdAt_idx" ON "CardHold"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CardHold" ADD CONSTRAINT "CardHold_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardHold" ADD CONSTRAINT "CardHold_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "NegotiationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

