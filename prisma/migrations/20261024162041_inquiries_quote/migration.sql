-- AlterTable
ALTER TABLE "NegotiationRequest" ADD COLUMN     "quote" JSONB,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "totalAgorot" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "NegotiationRequest_supplierId_createdAt_idx" ON "NegotiationRequest"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "NegotiationRequest_customerId_createdAt_idx" ON "NegotiationRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_supplierId_status_idx" ON "Review"("supplierId", "status");
