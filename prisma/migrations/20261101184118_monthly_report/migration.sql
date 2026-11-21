-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'MONTHLY_REPORT';

-- AlterTable
ALTER TABLE "MatchRequestLine" ADD COLUMN     "decidedAt" TIMESTAMP(3);
