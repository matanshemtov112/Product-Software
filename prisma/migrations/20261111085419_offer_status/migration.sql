-- CreateEnum
CREATE TYPE "OfferOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_VIEWED';
ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_DECIDED';
ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_CANCELLED';

-- AlterTable
ALTER TABLE "MatchRequest" ADD COLUMN     "cancelledBy" "Role",
ADD COLUMN     "offerSeenAt" TIMESTAMP(3),
ADD COLUMN     "outcome" "OfferOutcome",
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeNote" TEXT;

-- AlterTable
ALTER TABLE "NegotiationRequest" ADD COLUMN     "cancelledBy" "Role",
ADD COLUMN     "offerSeenAt" TIMESTAMP(3),
ADD COLUMN     "outcome" "OfferOutcome",
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeNote" TEXT,
ADD COLUMN     "validUntil" TIMESTAMP(3);
