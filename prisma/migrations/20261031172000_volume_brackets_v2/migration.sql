-- מדרגות היקף רכש חדשות: סלים שנשמרו עם מדרגה ישנה עוברים למדרגה החדשה שמכילה את תחילת הטווח הישן
UPDATE "Basket" SET "monthlyVolumeMinAgorot" = 0,        "monthlyVolumeMaxAgorot" = 500000   WHERE "monthlyVolumeMinAgorot" = 0;
UPDATE "Basket" SET "monthlyVolumeMinAgorot" = 1000000,  "monthlyVolumeMaxAgorot" = 3000000  WHERE "monthlyVolumeMinAgorot" IN (1000000, 2000000);
UPDATE "Basket" SET "monthlyVolumeMinAgorot" = 5000000,  "monthlyVolumeMaxAgorot" = 7000000  WHERE "monthlyVolumeMinAgorot" = 5000000;
UPDATE "Basket" SET "monthlyVolumeMinAgorot" = 9000000,  "monthlyVolumeMaxAgorot" = 11000000 WHERE "monthlyVolumeMinAgorot" = 10000000;
