-- תפקידים מוכנים לכל עובד: מנהל, קניין, מנהל מחירון, איש מכירות, צופה
CREATE TYPE "TeamRole" AS ENUM ('MANAGER', 'BUYER', 'PRICING', 'SALES', 'VIEWER');
ALTER TABLE "User" ADD COLUMN "teamRole" "TeamRole" NOT NULL DEFAULT 'VIEWER';

-- משתמשים קיימים שומרים על מה שיכלו לעשות עד היום
UPDATE "User" SET "teamRole" = 'MANAGER' WHERE "isManager" = true AND "role" <> 'ADMIN';
UPDATE "User" SET "teamRole" = 'BUYER' WHERE "isManager" = false AND "role" = 'CUSTOMER';
UPDATE "User" SET "teamRole" = 'PRICING' WHERE "isManager" = false AND "role" = 'SUPPLIER';
