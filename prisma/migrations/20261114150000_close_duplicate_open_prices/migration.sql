-- מחירים פתוחים כפולים לאותה מדרגה ולאותו סוג: כל מחיר נסגר ברגע שהמחיר הבא אחריו נכנס לתוקף.
-- ההיסטוריה נשמרת; רק נקבע עד מתי כל מחיר היה בתוקף. מעכשיו השמירה נועלת את המוצר ולא יוצרת כפילויות.
UPDATE "OfferPrice" AS p
SET "validTo" = n.next_from
FROM (
  SELECT id,
         LEAD("validFrom") OVER (PARTITION BY "offerId", "tierId", "kind" ORDER BY "validFrom", "createdAt", id) AS next_from
  FROM "OfferPrice"
  WHERE status = 'LIVE' AND "validTo" IS NULL
) AS n
WHERE p.id = n.id AND n.next_from IS NOT NULL;

-- מוצר מופיע פעם אחת בכל סל: מוחקים כפילויות ששמירה במקביל יצרה, ומונעים אותן מעכשיו
DELETE FROM "BasketItem" a
USING "BasketItem" b
WHERE a."basketId" = b."basketId" AND a."productId" = b."productId" AND a.id > b.id;

CREATE UNIQUE INDEX "BasketItem_basketId_productId_key" ON "BasketItem"("basketId", "productId");
