-- המשלוח תמיד חינם: יש רק מינימום הזמנה
ALTER TABLE "DeliveryZone" ALTER COLUMN "feeAgorot" SET DEFAULT 0;
UPDATE "DeliveryZone" SET "feeAgorot" = 0, "freeAboveAgorot" = NULL;
