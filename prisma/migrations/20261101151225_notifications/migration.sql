-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PRICE_INCREASE', 'PRICE_DROP', 'CHEAPER_SUPPLIER', 'SUPPLIER_REPLIED', 'MATCH_ANSWERED', 'NEW_INQUIRY', 'NEW_MATCH_REQUEST', 'MATCH_DECIDED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT NOT NULL,
    "savingsAgorot" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_customerId_read_createdAt_idx" ON "Notification"("customerId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_supplierId_read_createdAt_idx" ON "Notification"("supplierId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
