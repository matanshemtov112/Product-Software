-- סיבות דיווח נוספות: ספק שלא מכבד מחיר, מוצר לא תואם, ביקורת מזויפת, מידע שגוי
ALTER TYPE "ReportReason" ADD VALUE 'PRICE_NOT_HONORED';
ALTER TYPE "ReportReason" ADD VALUE 'PRODUCT_MISMATCH';
ALTER TYPE "ReportReason" ADD VALUE 'FAKE_REVIEW';
ALTER TYPE "ReportReason" ADD VALUE 'WRONG_INFO';
