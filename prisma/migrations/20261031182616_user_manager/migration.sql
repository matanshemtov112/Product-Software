-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isManager" BOOLEAN NOT NULL DEFAULT false;

-- עד עכשיו היה משתמש אחד לכל עסק וספק, ולכן כל המשתמשים הקיימים הם מנהלים
UPDATE "User" SET "isManager" = true WHERE "role" IN ('CUSTOMER', 'SUPPLIER');
