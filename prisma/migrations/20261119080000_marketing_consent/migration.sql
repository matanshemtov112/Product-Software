-- חוק הספאם: רישום הסכמה לדברי פרסומת, וקישור הסרה בכל אימייל
-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "unsubscribeUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsentSource" TEXT;

