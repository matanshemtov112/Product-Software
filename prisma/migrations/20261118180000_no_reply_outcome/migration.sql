-- פנייה שהספק לא ענה עליה תוך 3 ימים נסגרת; תזכורת לספק אחרי 24 שעות
ALTER TYPE "OfferOutcome" ADD VALUE 'NO_REPLY';
ALTER TYPE "NotificationKind" ADD VALUE 'REPLY_REMINDER';
ALTER TYPE "NotificationKind" ADD VALUE 'NO_REPLY';
