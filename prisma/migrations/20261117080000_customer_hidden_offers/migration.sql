-- לקוח יכול להסתיר מהרשימה שלו פנייה או בקשת השוואה שהסתיימו
ALTER TABLE "NegotiationRequest" ADD COLUMN "customerHiddenAt" TIMESTAMP(3);
ALTER TABLE "MatchRequest" ADD COLUMN "customerHiddenAt" TIMESTAMP(3);
