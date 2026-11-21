-- CreateEnum
CREATE TYPE "MatchReveal" AS ENUM ('EXACT', 'CEILING');

-- AlterTable
ALTER TABLE "MatchRequest" ADD COLUMN     "reveal" "MatchReveal" NOT NULL DEFAULT 'EXACT';

-- AlterTable
ALTER TABLE "MatchRequestLine" ADD COLUMN     "shownPriceAgorot" INTEGER;
