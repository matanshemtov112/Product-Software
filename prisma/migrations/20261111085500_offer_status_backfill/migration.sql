-- Existing data: a supplier that closed an inquiry without an offer counts as a cancelled offer,
-- and a closed match request is accepted when at least one price was accepted, otherwise rejected.
UPDATE "NegotiationRequest"
SET "outcome" = 'CANCELLED', "cancelledBy" = 'SUPPLIER', "outcomeAt" = COALESCE("repliedAt", "createdAt")
WHERE "status" = 'CLOSED' AND "outcome" IS NULL;

UPDATE "MatchRequest" m
SET "outcome" = CASE
    WHEN EXISTS (SELECT 1 FROM "MatchRequestLine" l WHERE l."requestId" = m."id" AND l."decision" = 'ACCEPTED')
    THEN 'ACCEPTED'::"OfferOutcome" ELSE 'REJECTED'::"OfferOutcome" END,
  "outcomeAt" = COALESCE(m."answeredAt", m."createdAt")
WHERE m."status" = 'CLOSED' AND m."outcome" IS NULL;
