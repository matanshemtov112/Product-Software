-- לקוח יכול למחוק מהרשימה שלו פנייה שהסתיימה; הסל שממנו נשלחה פנייה, לפנייה חדשה
ALTER TABLE "NegotiationRequest" ADD COLUMN "customerDeletedAt" TIMESTAMP(3);
ALTER TABLE "NegotiationRequest" ADD COLUMN "basketId" TEXT;
ALTER TABLE "MatchRequest" ADD COLUMN "customerDeletedAt" TIMESTAMP(3);
