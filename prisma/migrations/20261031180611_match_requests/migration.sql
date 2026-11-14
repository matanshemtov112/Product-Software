-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SENT', 'READ', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MatchResponse" AS ENUM ('PENDING', 'MATCHED', 'COUNTER', 'DECLINED');

-- CreateEnum
CREATE TYPE "MatchDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "basketId" TEXT,
    "message" TEXT,
    "customerProfile" JSONB,
    "status" "MatchStatus" NOT NULL DEFAULT 'SENT',
    "supplierNote" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "monthlyQuantity" DOUBLE PRECISION NOT NULL,
    "currentPriceAgorot" INTEGER NOT NULL,
    "targetPriceAgorot" INTEGER NOT NULL,
    "response" "MatchResponse" NOT NULL DEFAULT 'PENDING',
    "counterPriceAgorot" INTEGER,
    "decision" "MatchDecision" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "MatchRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchRequest_supplierId_createdAt_idx" ON "MatchRequest"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRequest_customerId_createdAt_idx" ON "MatchRequest"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequestLine" ADD CONSTRAINT "MatchRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MatchRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
